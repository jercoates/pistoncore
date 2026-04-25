# PistonCore — Dockerfile
#
# Build:   docker build -t pistoncore .
# Run:     see docker-compose.yml or the README for docker run command
#
# Python 3.12 slim — small image, no dev tools included.

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (cached layer — only rebuilds when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ .

# Copy frontend static files
COPY frontend/ ./frontend/

# Bundle the default customize files into the image
# The entrypoint copies these into the volume on first run if it is empty
COPY pistoncore-customize/ /app/defaults/pistoncore-customize/

# Copy and set the entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 7777

ENTRYPOINT ["/app/docker-entrypoint.sh"]
