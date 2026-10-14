@echo off
REM ──────────────────────────────────────────────────
REM  JeevanSetu — Quick Start (Windows)
REM  Usage:  cd NNbloodbank && start.bat
REM ──────────────────────────────────────────────────

cd /d "%~dp0"

echo ===============================================
echo   JeevanSetu — Hospital Blood Network
echo ===============================================

REM ── 1. Python virtual environment ────────────────
if not exist ".venv" (
    echo ^> Creating Python virtual environment...
    python -m venv .venv
)
echo ^> Activating virtual environment...
call .venv\Scripts\activate.bat

REM ── 2. Install Python dependencies ───────────────
echo ^> Installing Python dependencies...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

REM ── 3. Generate synthetic data ───────────────────
if not exist "blood_network.db" (
    echo ^> Generating synthetic hospital data...
    python generate_data.py
) else (
    echo ^> Database already exists (delete blood_network.db to regenerate^)
)

REM ── 4. Train forecast model ─────────────────────
if not exist "shortage_forecast_model.pt" (
    echo ^> Training neural network forecast model...
    python train_forecast_model.py
) else (
    echo ^> Model already trained (delete shortage_forecast_model.pt to retrain^)
)

REM ── 5. Build frontend ───────────────────────────
if not exist "frontend\node_modules" (
    echo ^> Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)
echo ^> Building frontend...
cd frontend
call npm run build
cd ..

REM ── 6. Start the server ─────────────────────────
echo.
echo ===============================================
echo   Starting server at http://127.0.0.1:8000
echo   Dashboard at   http://127.0.0.1:8000/app/
echo   Press Ctrl+C to stop
echo ===============================================
echo.
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
