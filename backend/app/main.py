"""
Medrion FastAPI application entry point.
Sets up CORS, includes all routers, and exposes a health check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.exams import router as exams_router
from app.api.notifications import router as notifications_router
from app.api.patients import router as patients_router
from app.api.pharmacies import router as pharmacies_router
from app.api.pharmacies import invites_router
from app.api.prescriptions import router as prescriptions_router
from app.api.users import router as users_router
from app.api.users import webhook_router
from app.config import settings

app = FastAPI(
    title="Medrion API",
    description="AI-powered prescription generation platform for Brazilian doctors.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

origins = [settings.FRONTEND_URL]

# Allow localhost variants in development
if "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL:
    origins += [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(webhook_router)
app.include_router(users_router)
app.include_router(notifications_router)
app.include_router(patients_router)
app.include_router(exams_router)
app.include_router(prescriptions_router)
app.include_router(pharmacies_router)
app.include_router(invites_router)
app.include_router(admin_router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Return service liveness status."""
    return {"status": "ok", "service": "medrion-api"}


@app.get("/", tags=["health"])
async def root() -> dict:
    """Root endpoint — same as health check."""
    return {"status": "ok", "service": "medrion-api"}
