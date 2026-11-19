from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.organizations import admin_router, organization_router
from app.api.routes.rbac import router as rbac_router
from app.api.routes.users import router as users_router
from app.auth.firebase import initialize_firebase
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if settings.firebase_project_id:
        initialize_firebase()
    yield


settings = get_settings()
app = FastAPI(title="UniVote API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(organization_router)
api_router.include_router(admin_router)
api_router.include_router(rbac_router)
app.include_router(api_router)
