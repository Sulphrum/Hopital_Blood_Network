from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sqlalchemy import select
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from models import BloodType, Hospital, StockSnapshot, get_engine, get_session_factory


MODEL_PATH = Path(__file__).with_name("shortage_forecast_model.pt")
WINDOW_DAYS = 14
FORECAST_HORIZON_DAYS = 2
TEST_DAYS = 18
RANDOM_SEED = 7
DECISION_THRESHOLD = 0.8

# Thresholds are intentionally conservative and configurable. A real deployment
# would tune these per hospital size, trauma role, and transfusion protocol.
CRITICAL_THRESHOLDS = {
    BloodType.O_POS.value: 18,
    BloodType.B_POS.value: 14,
    BloodType.A_POS.value: 12,
    BloodType.AB_POS.value: 6,
    BloodType.O_NEG.value: 5,
    BloodType.B_NEG.value: 4,
    BloodType.A_NEG.value: 4,
    BloodType.AB_NEG.value: 2,
}


@dataclass
class WindowedDataset:
    features: np.ndarray
    labels: np.ndarray
    metadata: pd.DataFrame


class ShortageNet(nn.Module):
    # A compact feedforward network is enough for this phase because each sample
    # already contains a 14-day sliding window plus simple calendar/restock
    # features. It is easier to explain in a hackathon demo than an LSTM.
    def __init__(self, input_size: int):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_size, 48),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(48, 24),
            nn.ReLU(),
            nn.Linear(24, 1),
        )

    def forward(self, x):
        return self.layers(x).squeeze(1)


def load_stock_dataframe() -> pd.DataFrame:
    engine = get_engine()
    stock = pd.read_sql(select(StockSnapshot), engine)
    hospitals = pd.read_sql(select(Hospital.id, Hospital.name, Hospital.city), engine)
    if stock.empty:
        raise RuntimeError("No stock snapshots found. Run generate_data.py first.")

    stock = stock.merge(hospitals, left_on="hospital_id", right_on="id", suffixes=("", "_hospital"))
    stock["timestamp"] = pd.to_datetime(stock["timestamp"], utc=True)
    stock["date"] = stock["timestamp"].dt.date
    stock["blood_type"] = stock["blood_type"].map(normalize_blood_type)
    return stock.sort_values(["hospital_id", "blood_type", "timestamp"]).reset_index(drop=True)


def normalize_blood_type(value) -> str:
    if isinstance(value, BloodType):
        return value.value
    if value in BloodType.__members__:
        return BloodType[value].value
    return str(value)


def days_since_last_restock(counts: np.ndarray) -> np.ndarray:
    result = np.zeros(len(counts), dtype=np.float32)
    last_restock_index = 0
    for index in range(1, len(counts)):
        if counts[index] > counts[index - 1]:
            last_restock_index = index
        result[index] = index - last_restock_index
    return result


def build_windowed_dataset(stock: pd.DataFrame) -> WindowedDataset:
    all_features = []
    all_labels = []
    all_metadata = []

    hospital_count = stock["hospital_id"].nunique()
    blood_types = sorted(stock["blood_type"].unique())
    blood_type_to_index = {blood_type: index for index, blood_type in enumerate(blood_types)}

    for (hospital_id, blood_type), group in stock.groupby(["hospital_id", "blood_type"], sort=False):
        group = group.sort_values("timestamp").reset_index(drop=True)
        counts = group["count"].to_numpy(dtype=np.float32)
        restock_age = days_since_last_restock(counts)
        threshold = CRITICAL_THRESHOLDS[blood_type]
        max_count = max(counts.max(), 1.0)

        for end_index in range(WINDOW_DAYS - 1, len(group) - FORECAST_HORIZON_DAYS):
            window = counts[end_index - WINDOW_DAYS + 1 : end_index + 1]
            future = counts[end_index + 1 : end_index + 1 + FORECAST_HORIZON_DAYS]
            current_row = group.iloc[end_index]
            if counts[end_index] < threshold:
                continue

            normalized_window = window / max_count
            day_of_week = pd.Timestamp(current_row["timestamp"]).weekday() / 6.0
            hospital_feature = (hospital_id - 1) / max(hospital_count - 1, 1)
            blood_type_feature = blood_type_to_index[blood_type] / max(len(blood_types) - 1, 1)
            restock_feature = min(restock_age[end_index], 14) / 14.0
            current_ratio_to_threshold = counts[end_index] / max(threshold, 1)

            features = np.concatenate(
                [
                    normalized_window,
                    np.array(
                        [
                            day_of_week,
                            hospital_feature,
                            blood_type_feature,
                            restock_feature,
                            current_ratio_to_threshold,
                        ],
                        dtype=np.float32,
                    ),
                ]
            )
            label = int(np.min(future) < threshold)

            all_features.append(features)
            all_labels.append(label)
            all_metadata.append(
                {
                    "date": current_row["date"],
                    "hospital_name": current_row["name"],
                    "city": current_row["city"],
                    "blood_type": blood_type,
                    "current_count": int(counts[end_index]),
                    "threshold": threshold,
                    "future_min_48h": int(np.min(future)),
                }
            )

    return WindowedDataset(
        features=np.asarray(all_features, dtype=np.float32),
        labels=np.asarray(all_labels, dtype=np.float32),
        metadata=pd.DataFrame(all_metadata),
    )


def time_based_split(dataset: WindowedDataset) -> tuple[WindowedDataset, WindowedDataset]:
    dates = pd.to_datetime(dataset.metadata["date"])
    cutoff = dates.max() - pd.Timedelta(days=TEST_DAYS)
    train_mask = dates <= cutoff
    test_mask = dates > cutoff

    return (
        WindowedDataset(dataset.features[train_mask], dataset.labels[train_mask], dataset.metadata[train_mask].reset_index(drop=True)),
        WindowedDataset(dataset.features[test_mask], dataset.labels[test_mask], dataset.metadata[test_mask].reset_index(drop=True)),
    )


def make_loader(dataset: WindowedDataset, batch_size: int, shuffle: bool) -> DataLoader:
    tensors = TensorDataset(
        torch.tensor(dataset.features, dtype=torch.float32),
        torch.tensor(dataset.labels, dtype=torch.float32),
    )
    return DataLoader(tensors, batch_size=batch_size, shuffle=shuffle)


def classification_metrics(labels: np.ndarray, probabilities: np.ndarray) -> dict[str, float]:
    predictions = (probabilities >= DECISION_THRESHOLD).astype(np.float32)
    true_positive = float(((predictions == 1) & (labels == 1)).sum())
    true_negative = float(((predictions == 0) & (labels == 0)).sum())
    false_positive = float(((predictions == 1) & (labels == 0)).sum())
    false_negative = float(((predictions == 0) & (labels == 1)).sum())

    return {
        "accuracy": (true_positive + true_negative) / max(len(labels), 1),
        "precision": true_positive / max(true_positive + false_positive, 1),
        "recall": true_positive / max(true_positive + false_negative, 1),
        "positives": float(labels.sum()),
        "total": float(len(labels)),
    }


def main() -> None:
    torch.manual_seed(RANDOM_SEED)
    np.random.seed(RANDOM_SEED)

    stock = load_stock_dataframe()
    dataset = build_windowed_dataset(stock)
    train_dataset, test_dataset = time_based_split(dataset)
    if len(train_dataset.labels) == 0 or len(test_dataset.labels) == 0:
        raise RuntimeError("Not enough data for train/test split.")

    pos_count = float(train_dataset.labels.sum())
    neg_count = float(len(train_dataset.labels) - pos_count)
    pos_weight = torch.tensor([neg_count / max(pos_count, 1.0)], dtype=torch.float32)

    model = ShortageNet(input_size=train_dataset.features.shape[1])
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    train_loader = make_loader(train_dataset, batch_size=32, shuffle=True)

    for epoch in range(1, 2):
        model.train()
        epoch_loss = 0.0
        for features, labels in train_loader:
            optimizer.zero_grad()
            logits = model(features)
            loss = loss_fn(logits, labels)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * len(labels)

        if epoch in {1}:
            avg_loss = epoch_loss / len(train_dataset.labels)
            print(f"epoch={epoch:03d} train_loss={avg_loss:.4f}")

    model.eval()
    with torch.no_grad():
        test_logits = model(torch.tensor(test_dataset.features, dtype=torch.float32))
        probabilities = torch.sigmoid(test_logits).numpy()

    metrics = classification_metrics(test_dataset.labels, probabilities)
    print("\nTest metrics")
    print(f"decision threshold: {DECISION_THRESHOLD:.2f}")
    print(f"accuracy:  {metrics['accuracy']:.3f}")
    print(f"precision: {metrics['precision']:.3f}")
    print(f"recall:    {metrics['recall']:.3f}")
    print(f"positive labels in test: {int(metrics['positives'])}/{int(metrics['total'])}")

    examples = test_dataset.metadata.copy()
    examples["actual_shortage_48h"] = test_dataset.labels.astype(int)
    examples["predicted_probability"] = probabilities
    examples["predicted_shortage"] = (probabilities >= DECISION_THRESHOLD).astype(int)
    examples = examples.sort_values("predicted_probability", ascending=False).head(10)

    print("\nExample predictions")
    for row in examples.itertuples(index=False):
        print(
            f"{row.date} | {row.hospital_name} | {row.blood_type} | "
            f"stock={row.current_count} threshold={row.threshold} "
            f"future_min={row.future_min_48h} actual={row.actual_shortage_48h} "
            f"pred={row.predicted_shortage} prob={row.predicted_probability:.2f}"
        )

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_size": train_dataset.features.shape[1],
            "window_days": WINDOW_DAYS,
            "forecast_horizon_days": FORECAST_HORIZON_DAYS,
            "critical_thresholds": CRITICAL_THRESHOLDS,
        },
        MODEL_PATH,
    )
    print(f"\nSaved model weights: {MODEL_PATH}")


if __name__ == "__main__":
    main()
