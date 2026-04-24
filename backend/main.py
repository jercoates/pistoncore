# pistoncore/backend/main.py
#
# PistonCore FastAPI application entry point.
# Run with: uvicorn main:app --host 0.0.0.0 --port 7777
#
# Docker mounts:
#   /pistoncore-userdata/     — piston JSON files, config, globals store
#   /pistoncore-customize/    — compiler templates, validation rules (user-editable)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import router

app = FastAPI(
    title="PistonCore",
    description="WebCoRE-style visual automation builder for Home Assistant",
    version="0.9",
)

# CORS — frontend is served separately (or from the same container on a different port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"status": "ok", "app": "PistonCore", "version": "0.9"}
