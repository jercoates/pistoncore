# PistonCore — Development Guide

## Prerequisites

- Python 3.12+
- Node 20+
- Docker (optional — for container testing)
- A running Home Assistant instance

---

## Running the Backend (FastAPI)

```bash
cd editor/backend
pip install -r requirements.txt

# Set environment variables
export PISTONCORE_HA_URL=http://your-ha-ip:8123
export PISTONCORE_HA_TOKEN=your_long_lived_token
export PISTONCORE_DATA_DIR=./dev-data
export PISTONCORE_DEBUG=true

# Start with live reload
uvicorn main:app --reload --port 7777
```

API docs available at: http://localhost:7777/docs

---

## Running the Frontend (React / Vite)

```bash
cd editor/frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

Vite proxies `/api/*` requests to the backend at `localhost:7777` automatically.
You only need the backend running — the frontend hot-reloads as you edit.

---

## Running with Docker Compose

```bash
# Build and start
docker compose up --build

# Access the editor
open http://localhost:7777
```

Set your HA URL and token in `docker-compose.yml` before starting.

---

## Project Structure

```
pistoncore/
├── editor/
│   ├── backend/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── requirements.txt
│   │   ├── api/routes/          # One file per API resource
│   │   │   ├── entities.py      # GET /api/entities
│   │   │   ├── pistons.py       # CRUD /api/pistons
│   │   │   ├── globals_.py      # /api/globals
│   │   │   ├── settings.py      # /api/settings
│   │   │   └── compile_.py      # /api/compile
│   │   ├── core/
│   │   │   ├── config.py        # Settings from env vars
│   │   │   └── storage.py       # Piston JSON file I/O
│   │   ├── models/
│   │   │   ├── entity.py        # Entity Pydantic models
│   │   │   └── piston.py        # Piston / all piston models
│   │   └── services/
│   │       ├── ha_client.py     # All HA API communication
│   │       ├── entity_service.py # HA state → PistonCore entity
│   │       └── compiler.py      # Piston → YAML / PyScript
│   └── frontend/
│       └── src/
│           ├── App.jsx           # Router
│           ├── components/
│           │   ├── layout/       # AppLayout, nav
│           │   ├── piston/       # All editor section components
│           │   └── shared/       # CollapsibleSection, EntityPicker
│           ├── pages/            # PistonList, Editor, Globals, Settings
│           └── utils/api.js      # All backend API calls
├── companion/
│   └── custom_components/pistoncore/
│       ├── __init__.py          # HA integration entry point
│       ├── manifest.json
│       ├── config_flow.py       # Setup UI in HA
│       ├── const.py
│       └── api.py               # HTTP endpoints for file writes + reloads
└── docker-compose.yml
```

---

## What's Working (Session 2)

- Full folder structure
- FastAPI backend with all routes registered (19 endpoints)
- Pydantic models for all piston concepts from the design doc
- HA API client with caching and clean error messages
- Entity service — transforms raw HA states to friendly-name objects
- Compiler — simple pistons → HA YAML, complex pistons → PyScript stub
- Piston storage — JSON files in Docker volume, full CRUD
- React frontend shell — routing, layout, all pages scaffolded
- All piston editor sections: Header, Variables, Triggers, Conditions, Actions
- EntityPicker — live HA entity data in dropdowns, friendly names only
- Compile preview modal
- CompilePreview and Deploy buttons wired to backend
- Companion integration skeleton — manifest, config flow, HTTP API for file writes

## What's Next (Session 3)

- [ ] If/Then/Else nested action editor
- [ ] Full PyScript compiler
- [ ] Import piston flow — role mapping UI
- [ ] Connect companion deploy to editor (end-to-end deploy test)
- [ ] Piston log panel (run history)
- [ ] Test / dry run button
- [ ] Frontend: serve static files from FastAPI in production build
- [ ] hacs.json for companion HACS distribution
