#!/usr/bin/env bash
# ──────────────────────────────────────────────────
# JeevanSetu — Quick Start (Mac / Linux)
# Usage:  cd NNbloodbank && bash start.sh
# ──────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════════"
echo "  JeevanSetu — Hospital Blood Network"
echo "═══════════════════════════════════════════════"

# ── 1. Python virtual environment ────────────────
if [ ! -d ".venv" ]; then
    echo "▸ Creating Python virtual environment..."
    python3 -m venv .venv
fi
echo "▸ Activating virtual environment..."
source .venv/bin/activate

# ── 2. Install Python dependencies ───────────────
echo "▸ Installing Python dependencies..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

# ── 3. Generate synthetic data ───────────────────
if [ ! -f "blood_network.db" ]; then
    echo "▸ Generating synthetic hospital data..."
    python generate_data.py
else
    echo "▸ Database already exists (delete blood_network.db to regenerate)"
fi

# ── 4. Train forecast model ─────────────────────
if [ ! -f "shortage_forecast_model.pt" ]; then
    echo "▸ Training neural network forecast model..."
    python train_forecast_model.py
else
    echo "▸ Model already trained (delete shortage_forecast_model.pt to retrain)"
fi

# ── 5. Build frontend ───────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    echo "▸ Installing frontend dependencies..."
    (cd frontend && npm install)
fi
echo "▸ Building frontend..."
(cd frontend && npm run build)

# ── 6. Start the server ─────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Starting server at http://127.0.0.1:8000"
echo "  Dashboard at   http://127.0.0.1:8000/app/"
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════"
echo ""
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
