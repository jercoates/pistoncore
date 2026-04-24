# PistonCore Backend

This folder contains the PistonCore backend — the Python FastAPI application that stores pistons, compiles piston JSON into native Home Assistant files, and exposes a REST API for the frontend.

## Files

| File | What it does |
|---|---|
| `compiler.py` | Compiles piston JSON → two HA YAML strings (automation + script). Matches COMPILER_SPEC.md v0.2. |
| `main.py` | FastAPI app entry point. Runs on port 7777. |
| `api.py` | All REST API endpoints. See endpoint list below. |
| `storage.py` | All filesystem I/O — piston JSON files, globals store, config. Never called directly by the compiler. |

## Running Locally

```bash
cd backend
pip install fastapi uvicorn jinja2 pyyaml
PISTONCORE_DATA_DIR=./testdata PISTONCORE_TEMPLATE_DIR=../pistoncore-customize/compiler-templates/native-script/ uvicorn main:app --host 0.0.0.0 --port 7777 --reload
```

The `PISTONCORE_DATA_DIR` env var lets you point storage at a local test folder instead of `/pistoncore-userdata/`.

## API Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | /pistons | List all pistons (summary only) |
| GET | /pistons/{id} | Get full piston JSON |
| POST | /pistons | Create a new piston |
| PUT | /pistons/{id} | Save piston to Docker volume (no HA write) |
| DELETE | /pistons/{id} | Delete piston from storage |
| POST | /pistons/{id}/compile | Compile and return YAML strings (no HA write) |
| POST | /pistons/{id}/deploy | Compile + send to companion for HA write |
| GET | /globals | List global variables |
| POST | /globals | Create a global variable |
| DELETE | /globals/{id} | Delete a global variable |
| GET | /config | Get runtime config (token redacted) |
| PUT | /config | Update runtime config |
| GET | /health | Health check |

## Two Save Operations

There are two distinct save operations — the frontend must make this clear to users:

1. **Save** (`PUT /pistons/{id}`) — writes the piston JSON to the Docker volume. Fast, always works, no HA involvement. This is what the Save button does.
2. **Deploy** (`POST /pistons/{id}/deploy`) — compiles the piston and sends the YAML files to HA via the companion. Requires the companion to be installed.

## Compiler Quick Test

Run the compiler standalone against the driveway lights test piston (COMPILER_SPEC Section 17):

```bash
cd backend
PISTONCORE_TEMPLATE_DIR=../pistoncore-customize/compiler-templates/native-script/ python compiler.py
```

Expected output matches the hand-written example in COMPILER_SPEC.md Section 17.

## For AI Assistants

Read DESIGN.md v0.9.1 and COMPILER_SPEC.md v0.2 before modifying any file in this folder.

- `compiler.py` — each method references the COMPILER_SPEC section it implements. Add new statement types by adding an `elif` in `_compile_sequence()` and a `_compile_<type>()` method.
- `api.py` — the deploy endpoint has a clearly marked companion stub. Replace `_send_to_companion()` when the companion integration is built.
- `storage.py` — all file paths go through this module. Do not read or write files from `api.py` or `compiler.py` directly.

Do not change the design documents. The backend serves the spec — not the other way around.
