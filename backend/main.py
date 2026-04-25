# pistoncore/backend/main.py
#
# PistonCore FastAPI application entry point.
# Run with: uvicorn main:app --host 0.0.0.0 --port 7777
#
# Docker mounts:
#   /pistoncore-userdata/     — piston JSON files, config, globals store
#   /pistoncore-customize/    — compiler templates, validation rules (user-editable)
#
# Frontend:
#   Served as static files from /frontend/ (relative to this file's parent directory).
#   In the Docker container this resolves to /app/frontend/.
#   The root URL (/) serves index.html.

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api import router

app = FastAPI(
    title="PistonCore",
    description="WebCoRE-style visual automation builder for Home Assistant",
    version="0.9",
)

# CORS — kept permissive; tighten if exposing beyond LAN
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# ── Frontend static files ────────────────────────────────────────────────────
#
# The frontend/ folder lives one level up from backend/ in the repo:
#   /app/backend/main.py
#   /app/frontend/index.html
#   /app/frontend/css/style.css
#   /app/frontend/js/...
#
# Served at /frontend/* so index.html can reference /frontend/css/style.css
# and /frontend/js/*.js with absolute paths.

_HERE = Path(__file__).parent                   # /app (backend/ files land here)
_FRONTEND = _HERE / "frontend"                  # /app/frontend/

if _FRONTEND.exists():
    app.mount("/frontend", StaticFiles(directory=str(_FRONTEND)), name="frontend")

    @app.get("/", include_in_schema=False)
    def serve_index():
        """Serve the SPA shell."""
        return FileResponse(str(_FRONTEND / "index.html"))

else:
    # Frontend not present — return JSON root for API-only mode
    @app.get("/")
    def root():
        return {"status": "ok", "app": "PistonCore", "version": "0.9", "frontend": "not found"}
