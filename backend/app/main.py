from __future__ import annotations

import logging
import logging.config

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.firebase_admin import initialize_firebase
from app.api.eligibility import router as eligibility_router
from app.api.auth import router as auth_router
from app.api.students import router as students_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if not settings.is_production else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Application Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Startup / shutdown lifecycle hook.
    Firebase Admin SDK is initialised exactly once on startup.
    """
    logger.info("Starting University Voting API (env=%s)", settings.APP_ENV)
    initialize_firebase()
    yield
    logger.info("University Voting API shutting down")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="University Voting API",
    description=(
        "Backend API for the university voting system. "
        "Handles Firebase token verification, user management, and application logic."
    ),
    version="1.0.0",
    lifespan=lifespan,
    # In production, disable the interactive docs UI if desired.
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# ── CORS Middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(eligibility_router)
app.include_router(students_router)


# ── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"], summary="Health check")
async def health_check() -> dict:
    """Simple health check for deployment platforms (Render, etc.)."""
    return {"status": "ok", "env": settings.APP_ENV}
