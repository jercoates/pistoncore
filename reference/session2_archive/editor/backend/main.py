"""
PistonCore Editor — FastAPI Backend
Entry point for the PistonCore editor server.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from api.routes import entities, pistons, globals_, settings, compile_
from core.config import settings as app_settings
from core.storage import init_storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pistoncore")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PistonCore starting up...")
    init_storage()
    yield
    logger.info("PistonCore shutting down.")


app = FastAPI(
    title="PistonCore",
    description="WebCoRE-style visual automation builder for Home Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tightened in production via config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(entities.router, prefix="/api/entities", tags=["entities"])
app.include_router(pistons.router, prefix="/api/pistons", tags=["pistons"])
app.include_router(globals_.router, prefix="/api/globals", tags=["globals"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(compile_.router, prefix="/api/compile", tags=["compile"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
