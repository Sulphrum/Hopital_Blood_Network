FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install PyTorch CPU-only (much smaller than full torch ~200MB vs ~2GB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY models.py .
COPY generate_data.py .
COPY train_forecast_model.py .
COPY api/ ./api/

# Generate synthetic data and train the model at build time
RUN python generate_data.py && python train_forecast_model.py

# Expose the port Railway will use
EXPOSE ${PORT:-8000}

# Start the server — Railway sets $PORT automatically
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
