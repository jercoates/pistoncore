# PistonCore — Dockerfile
#
# Build:   docker build -t pistoncore .
# Run:     docker-compose up -d  (see docker-compose.yml)
#
# Python 3.12 slim — small image, no dev tools included.

FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies first (cached layer — only rebuilds when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Expose the PistonCore port
EXPOSE 7777

# Run uvicorn on all interfaces so Docker port mapping works
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7777"]
