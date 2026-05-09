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

import logging
import os
from pathlib import Path

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from api import router

# Central logging config (Gap E — Grok review)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("pistoncore")

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
        """Serve the SPA shell with BASE_URL injected into <head> (GAP-S29-6)."""
        index_path = _FRONTEND / "index.html"
        html = index_path.read_text()
        # Read from env var so Unraid/remote deployments don't need localhost.
        # Set PISTONCORE_BASE_URL in docker-compose.yml, e.g. http://192.168.1.10:7777
        base_url = os.environ.get("PISTONCORE_BASE_URL", "http://localhost:7777")
        base_url_script = f'<script>window.PISTONCORE_BASE_URL = "{base_url}";</script>'
        html = html.replace("</head>", f"{base_url_script}\n</head>", 1)
        return HTMLResponse(content=html)

else:
    # Frontend not present — return JSON root for API-only mode
    @app.get("/")
    def root():
        return {"status": "ok", "app": "PistonCore", "version": "0.9", "frontend": "not found"}


# ── WebSocket stub ───────────────────────────────────────────────────────────
#
# Accepts connections and keeps them open. Full trace/log streaming in S2-x.
# Frontend connects on load — without this stub it gets an immediate 404 and
# may retry aggressively. (GAP-S29-7)

@app.websocket("/ws")
async def websocket_stub(websocket: WebSocket):
    """WebSocket stub — accepts and holds connections. Full impl in S2-x."""
    await websocket.accept()
    logger.info("WebSocket client connected")
    try:
        while True:
            await websocket.receive_text()  # stay alive, discard incoming messages
    except Exception:
        pass  # client disconnected — normal teardown
