FROM python:3.12-slim

WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend (populated by CI or local build step)
COPY frontend/dist/ ./frontend/dist/

# Serve frontend as static files via FastAPI
# (FastAPI serves /frontend/dist as static at /)
ENV PYTHONPATH=/app/backend

EXPOSE 7777

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7777"]
