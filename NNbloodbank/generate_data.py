from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import select

from models import (
    DEFAULT_SHELF_LIFE_DAYS,
    BloodBag,
    BloodBagStatus,
    BloodType,
    Hospital,
    User,
    StockSnapshot,
    create_database,
    get_session_factory,
)


OUTPUT_CSV = Path(__file__).with_name("stock_snapshots.csv")
DAYS_TO_GENERATE = 90
RANDOM_SEED = 42

# Approximate India-facing blood group mix used for synthetic allocation.
# Simplifying assumption: percentages vary by region, so this is intentionally
# rough rather than presented as clinical truth.
BLOOD_TYPE_PREVALENCE = {
    BloodType.O_POS: 0.35,
    BloodType.B_POS: 0.32,
    BloodType.A_POS: 0.22,
    BloodType.AB_POS: 0.07,
    BloodType.O_NEG: 0.018,
    BloodType.B_NEG: 0.012,
    BloodType.A_NEG: 0.008,
    BloodType.AB_NEG: 0.002,
}

TRAUMA_HEAVY_TYPES = {BloodType.O_POS, BloodType.O_NEG}


@dataclass(frozen=True)
class HospitalProfile:
    name: str
    city: str
    lat: float
    lng: float
    capacity_units: int
    restock_min_days: int
    restock_max_days: int
    reliability: float
    demand_intensity: float
    target_stock: dict[BloodType, int]


HOSPITAL_PROFILES = [
    HospitalProfile(
        "Sassoon General Hospital Blood Centre",
        "Pune",
        18.5289,
        73.8744,
        420,
        5,
        7,
        0.91,
        1.18,
        {
            BloodType.O_POS: 52,
            BloodType.B_POS: 48,
            BloodType.A_POS: 40,
            BloodType.AB_POS: 14,
            BloodType.O_NEG: 12,
            BloodType.B_NEG: 10,
            BloodType.A_NEG: 9,
            BloodType.AB_NEG: 5,
        },
    ),
    HospitalProfile(
        "Ruby Hall Clinic Blood Bank",
        "Pune",
        18.5332,
        73.8768,
        360,
        5,
        8,
        0.89,
        1.02,
        {
            BloodType.O_POS: 44,
            BloodType.B_POS: 41,
            BloodType.A_POS: 33,
            BloodType.AB_POS: 13,
            BloodType.O_NEG: 10,
            BloodType.B_NEG: 9,
            BloodType.A_NEG: 8,
            BloodType.AB_NEG: 5,
        },
    ),
    HospitalProfile(
        "Deenanath Mangeshkar Hospital Blood Bank",
        "Pune",
        18.5018,
        73.8335,
        390,
        6,
        8,
        0.86,
        1.08,
        {
            BloodType.O_POS: 36,
            BloodType.B_POS: 32,
            BloodType.A_POS: 28,
            BloodType.AB_POS: 10,
            BloodType.O_NEG: 8,
            BloodType.B_NEG: 7,
            BloodType.A_NEG: 6,
            BloodType.AB_NEG: 4,
        },
    ),
    HospitalProfile(
        "Jehangir Hospital Blood Bank",
        "Pune",
        18.5312,
        73.8760,
        310,
        6,
        9,
        0.83,
        1.12,
        {
            BloodType.O_POS: 27,
            BloodType.B_POS: 27,
            BloodType.A_POS: 22,
            BloodType.AB_POS: 8,
            BloodType.O_NEG: 5,
            BloodType.B_NEG: 5,
            BloodType.A_NEG: 4,
            BloodType.AB_NEG: 2,
        },
    ),
    HospitalProfile(
        "Aditya Birla Memorial Hospital Blood Bank",
        "Pimpri-Chinchwad",
        18.6255,
        73.7748,
        330,
        5,
        8,
        0.88,
        0.96,
        {
            BloodType.O_POS: 48,
            BloodType.B_POS: 39,
            BloodType.A_POS: 34,
            BloodType.AB_POS: 12,
            BloodType.O_NEG: 11,
            BloodType.B_NEG: 9,
            BloodType.A_NEG: 8,
            BloodType.AB_NEG: 5,
        },
    ),
    HospitalProfile(
        "Yashwantrao Chavan Memorial Hospital Blood Bank",
        "Pimpri-Chinchwad",
        18.6298,
        73.7997,
        300,
        6,
        9,
        0.81,
        1.22,
        {
            BloodType.O_POS: 20,
            BloodType.B_POS: 18,
            BloodType.A_POS: 16,
            BloodType.AB_POS: 6,
            BloodType.O_NEG: 3,
            BloodType.B_NEG: 4,
            BloodType.A_NEG: 3,
            BloodType.AB_NEG: 1,
        },
    ),
]

# Simulated demand events inside the 90-day window. These are not tied to the
# current calendar; they create explainable learning signal for the demo.
DEMAND_EVENTS = {
    12: ("Pune expressway trauma weekend", 2.1),
    31: ("Ganesh Visarjan emergency demand", 2.5),
    57: ("holiday travel accident cluster", 2.2),
    78: ("city marathon medical load", 1.8),
}

MASS_CASUALTY_EVENT = {
    "day": 49,
    "hospital_index": 5,
    "name": "localized highway pile-up near Pimpri-Chinchwad",
    "multiplier": 3.6,
}


def snapshot_datetime(day: date) -> datetime:
    return datetime.combine(day, time(hour=18), tzinfo=timezone.utc)


def initial_stock(profile: HospitalProfile, blood_type: BloodType) -> int:
    prevalence = BLOOD_TYPE_PREVALENCE[blood_type]
    target = profile.target_stock[blood_type]
    common_buffer = profile.capacity_units * prevalence * 0.16
    rare_buffer = 5 if prevalence < 0.02 else 0
    return max(target + 2, int(round(target + common_buffer + rare_buffer)))


def daily_usage(rng: np.random.Generator, profile: HospitalProfile, blood_type: BloodType) -> int:
    prevalence = BLOOD_TYPE_PREVALENCE[blood_type]
    expected = max(0.25, profile.capacity_units * prevalence * rng.uniform(0.014, 0.036))
    expected *= profile.demand_intensity
    if blood_type in TRAUMA_HEAVY_TYPES:
        expected *= 1.25
    return max(0, int(rng.poisson(expected)))


def restock_quantity(rng: np.random.Generator, profile: HospitalProfile, blood_type: BloodType) -> int:
    prevalence = BLOOD_TYPE_PREVALENCE[blood_type]
    expected = profile.capacity_units * prevalence * rng.uniform(0.19, 0.38) * profile.reliability
    if prevalence < 0.02:
        expected += rng.uniform(2, 5)
    return max(1, int(round(expected)))


def make_hospitals(session) -> list[Hospital]:
    hospitals = []
    for profile in HOSPITAL_PROFILES:
        hospital = Hospital(
            name=profile.name,
            city=profile.city,
            lat=profile.lat,
            lng=profile.lng,
        )
        session.add(hospital)
        hospitals.append(hospital)
    session.flush()
    return hospitals


def generate_stock_history(session, rng: np.random.Generator, start_date: date) -> pd.DataFrame:
    hospitals = make_hospitals(session)
    records = []

    for hospital_index, (hospital, profile) in enumerate(zip(hospitals, HOSPITAL_PROFILES)):
        stock = {blood_type: initial_stock(profile, blood_type) for blood_type in BloodType}
        next_restock_day = {
            blood_type: int(rng.integers(profile.restock_min_days, profile.restock_max_days + 1))
            for blood_type in BloodType
        }

        for day_offset in range(DAYS_TO_GENERATE):
            current_date = start_date + timedelta(days=day_offset)
            event_name, event_multiplier = DEMAND_EVENTS.get(day_offset, (None, 1.0))

            for blood_type in BloodType:
                if day_offset == next_restock_day[blood_type]:
                    if rng.random() < profile.reliability:
                        stock[blood_type] += restock_quantity(rng, profile, blood_type)
                    next_restock_day[blood_type] += int(
                        rng.integers(profile.restock_min_days, profile.restock_max_days + 1)
                    )

                usage = daily_usage(rng, profile, blood_type)
                if event_name:
                    usage = int(round(usage * (event_multiplier if blood_type in TRAUMA_HEAVY_TYPES else 1.35)))

                if (
                    day_offset == MASS_CASUALTY_EVENT["day"]
                    and hospital_index == MASS_CASUALTY_EVENT["hospital_index"]
                ):
                    multiplier = MASS_CASUALTY_EVENT["multiplier"] if blood_type in TRAUMA_HEAVY_TYPES else 2.0
                    usage = int(round(max(usage, 1) * multiplier))

                weekend_factor = 1.12 if current_date.weekday() in {5, 6} else 1.0
                stock[blood_type] = max(0, int(round(stock[blood_type] - usage * weekend_factor)))
                target = profile.target_stock[blood_type]
                days_remaining = DAYS_TO_GENERATE - day_offset - 1
                if days_remaining < 21:
                    correction = int(round((stock[blood_type] - target) / max(days_remaining + 1, 1)))
                    stock[blood_type] = max(0, stock[blood_type] - correction + int(rng.integers(-1, 2)))
                if day_offset == DAYS_TO_GENERATE - 1:
                    stock[blood_type] = target

                snapshot = StockSnapshot(
                    hospital_id=hospital.id,
                    blood_type=blood_type,
                    count=stock[blood_type],
                    timestamp=snapshot_datetime(current_date),
                )
                session.add(snapshot)
                records.append(
                    {
                        "date": current_date.isoformat(),
                        "hospital_id": hospital.id,
                        "hospital_name": hospital.name,
                        "city": hospital.city,
                        "blood_type": blood_type.value,
                        "count": stock[blood_type],
                    }
                )

    return pd.DataFrame(records)


def collection_date_for_available_bag(
    rng: np.random.Generator, simulation_end: date, near_expiry: bool
) -> date:
    if near_expiry:
        days_before_end = int(rng.integers(DEFAULT_SHELF_LIFE_DAYS - 5, DEFAULT_SHELF_LIFE_DAYS + 1))
    else:
        days_before_end = int(rng.integers(2, DEFAULT_SHELF_LIFE_DAYS - 6))
    return simulation_end - timedelta(days=days_before_end)


def generate_blood_bags(session, rng: np.random.Generator, simulation_end: date) -> None:
    latest_snapshots = session.execute(
        select(StockSnapshot).where(StockSnapshot.timestamp == snapshot_datetime(simulation_end))
    ).scalars()

    for snapshot in latest_snapshots:
        for _ in range(snapshot.count):
            near_expiry = rng.random() < 0.22
            collection_date = collection_date_for_available_bag(rng, simulation_end, near_expiry)
            session.add(
                BloodBag(
                    hospital_id=snapshot.hospital_id,
                    blood_type=snapshot.blood_type,
                    collection_date=collection_date,
                    status=BloodBagStatus.AVAILABLE,
                )
            )

        expired_count = max(1, int(round(snapshot.count * rng.uniform(0.03, 0.08)))) if snapshot.count else 1
        for _ in range(expired_count):
            collection_date = simulation_end - timedelta(
                days=int(rng.integers(DEFAULT_SHELF_LIFE_DAYS + 3, DEFAULT_SHELF_LIFE_DAYS + 18))
            )
            session.add(
                BloodBag(
                    hospital_id=snapshot.hospital_id,
                    blood_type=snapshot.blood_type,
                    collection_date=collection_date,
                    status=BloodBagStatus.EXPIRED,
                )
            )


def hash_password(password: str) -> str:
    import hashlib
    import os
    salt = os.urandom(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return f"{salt.hex()}:{pwd_hash.hex()}"


def main() -> None:
    rng = np.random.default_rng(RANDOM_SEED)
    end_date = date.today()
    start_date = end_date - timedelta(days=DAYS_TO_GENERATE - 1)

    create_database(reset=True)
    Session = get_session_factory()
    with Session() as session:
        stock_df = generate_stock_history(session, rng, start_date)
        session.flush()
        generate_blood_bags(session, rng, end_date)
        
        # Seed default user
        demo_user = User(
            name="Blood Bank Manager",
            email="manager@jeevansetu.demo",
            password_hash=hash_password("password123"),
            hospital_id=1
        )
        session.add(demo_user)
        
        session.commit()

    stock_df.to_csv(OUTPUT_CSV, index=False)
    print(f"Created SQLite database: {Path(__file__).with_name('blood_network.db')}")
    print(f"Exported stock snapshot CSV: {OUTPUT_CSV}")
    print(f"Rows: {len(stock_df)} stock snapshots across {DAYS_TO_GENERATE} days")


if __name__ == "__main__":
    main()
