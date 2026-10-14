# JeevanSetu — Connected Hospital Blood Network

> **A neural-network-powered blood inventory management and shortage prediction system for Pune's hospital network.**

The system runs 6 real Pune-area hospital blood banks (Sassoon, Ruby Hall, Deenanath Mangeshkar, Jehangir, Aditya Birla, YCM), predicts critical shortages 48 hours in advance using a trained neural network, and suggests inter-hospital blood transfers before wastage or shortage occurs.

---

## Quick Start

### Mac / Linux

```bash
cd NNbloodbank
bash start.sh
```

Then open **http://127.0.0.1:8000/app/** in your browser.

### Windows

```bat
cd NNbloodbank
start.bat
```

Then open **http://127.0.0.1:8000/app/** in your browser.

> The startup scripts automatically handle everything: Python venv, pip install, data generation, model training, frontend build, and server launch.

---

## Manual Setup (if you prefer step by step)

```bash
cd NNbloodbank

# 1 — Python environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate.bat
pip install -r requirements.txt

# 2 — Generate synthetic data + train model
python generate_data.py
python train_forecast_model.py

# 3 — Frontend
cd frontend
cp .env.example .env               # Add your Gemini API key (optional)
npm install
npm run build
cd ..

# 4 — Run the server
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Gemini AI Insight (Optional)

The Forecast page shows a one-line AI insight per blood type. To enable it:

1. Get a free key at https://aistudio.google.com/app/apikey
2. Copy `frontend/.env.example` → `frontend/.env`
3. Replace `YOUR_GEMINI_API_KEY_HERE` with your actual key
4. Rebuild: `cd frontend && npm run build`

The system works without a key — it falls back to data-driven local insights.

---

## Architecture

```
NNbloodbank/
├── generate_data.py        # Synthetic 90-day data for 6 Pune hospitals
├── train_forecast_model.py # PyTorch neural network training (Phase 0)
├── models.py               # SQLAlchemy ORM models
├── hospital_simulator.py   # CLI tool to simulate live stock updates
├── api/
│   ├── main.py             # FastAPI backend (Phases 1 & 2)
│   └── schemas.py          # Pydantic request/response schemas
└── frontend/               # React + Vite dashboard (Phases 3-5)
    └── src/
        ├── pages/          # Dashboard, Inventory, Forecast, Transfers, etc.
        └── services/       # API integration layer
```

See [`NNbloodbank/README.md`](NNbloodbank/README.md) for full API docs and details.

---

## Hospitals in the Network

| # | Hospital | City |
|---|---|---|
| 1 | Sassoon General Hospital Blood Centre | Pune |
| 2 | Ruby Hall Clinic Blood Bank | Pune |
| 3 | Deenanath Mangeshkar Hospital Blood Bank | Pune |
| 4 | Jehangir Hospital Blood Bank | Pune |
| 5 | Aditya Birla Memorial Hospital Blood Bank | Pimpri-Chinchwad |
| 6 | Yashwantrao Chavan Memorial Hospital Blood Bank | Pimpri-Chinchwad |
