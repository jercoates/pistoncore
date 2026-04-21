# PistonCore Backend

This folder contains the PistonCore backend — the Python code that compiles piston JSON into native Home Assistant files.

## Start Here

**`compiler.py`** — the compiler. Reads piston JSON, produces two YAML strings (automation wrapper + script body). Matches [COMPILER_SPEC.md](../COMPILER_SPEC.md) exactly.

## Quick Test

Run the compiler against the driveway lights test piston:

```bash
cd backend
PISTONCORE_TEMPLATE_DIR=../pistoncore-customize/compiler-templates/native-script/ python compiler.py
```

Expected output matches the hand-written example in COMPILER_SPEC.md Section 17.

## What Doesn't Exist Yet

- `main.py` — FastAPI application (Session 8)
- `api.py` — API endpoints (Session 8)
- Docker container setup (later)

## For AI Assistants

Read [COMPILER_SPEC.md](../COMPILER_SPEC.md) before modifying this file. Every method references the spec section it implements. Add new statement types by adding an `elif` in `_compile_sequence()` and a corresponding `_compile_<type>()` method.

Do not change the design documents. The compiler serves the spec — not the other way around.
