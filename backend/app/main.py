"""
Punto de entrada de la API. Sólo configura la app y monta routers versionados.
Ningún import de infraestructura concreta (OpenAI, OpenWA, scraper) debe aparecer aquí:
eso se resuelve vía dependency injection al construir los routers.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.api.v1.ai.router import router as ai_router
from app.infrastructure.api.v1.auth.router import router as auth_router
from app.infrastructure.api.v1.campaigns.router import router as campaigns_router
from app.infrastructure.api.v1.dashboard.router import router as dashboard_router
from app.infrastructure.api.v1.leads.router import router as leads_router
from app.infrastructure.api.v1.prospecting.router import router as prospecting_router
from app.infrastructure.api.v1.follow_ups.router import router as follow_ups_router
from app.infrastructure.api.v1.templates.router import router as templates_router
from app.infrastructure.api.v1.users.router import router as users_router
from app.infrastructure.api.v1.whatsapp.router import router as whatsapp_router
from app.infrastructure.api.v1.whatsapp.router import webhook_router as whatsapp_webhook_router
from app.infrastructure.api.v1.whatsapp.cloud_router import router as whatsapp_cloud_router
from app.infrastructure.config.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # TODO: inicializar pool de DB, conexión Redis, health checks de providers
    yield
    # TODO: cerrar conexiones


def create_app() -> FastAPI:
    app = FastAPI(
        title="JarvisIA API",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rutas sin scope de workspace (auth, usuarios de la organización)
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(users_router, prefix="/api/v1/users", tags=["users"])

    # Webhook público de WhatsApp (lo llama el servidor OpenWA, no un usuario logueado)
    app.include_router(whatsapp_webhook_router, prefix="/api/v1/whatsapp", tags=["whatsapp-webhook"])
    app.include_router(whatsapp_cloud_router, prefix="/api/v1/whatsapp/cloud", tags=["whatsapp-cloud"])

    # Rutas scoped por workspace (Organization → Workspace → User)
    workspace_prefix = "/api/v1/workspaces/{workspace_id}"
    # Prospección primero: sus rutas fijas (/import-jobs, /outreach-queue) no deben caer en /{lead_id}.
    app.include_router(prospecting_router, prefix=f"{workspace_prefix}/leads", tags=["prospecting"])
    app.include_router(leads_router, prefix=f"{workspace_prefix}/leads", tags=["leads"])
    app.include_router(follow_ups_router, prefix=f"{workspace_prefix}/follow-ups", tags=["follow-ups"])
    app.include_router(campaigns_router, prefix=f"{workspace_prefix}/campaigns", tags=["campaigns"])
    app.include_router(templates_router, prefix=f"{workspace_prefix}/templates", tags=["templates"])
    app.include_router(whatsapp_router, prefix=f"{workspace_prefix}/whatsapp", tags=["whatsapp"])
    app.include_router(dashboard_router, prefix=f"{workspace_prefix}/dashboard", tags=["dashboard"])
    app.include_router(ai_router, prefix=f"{workspace_prefix}/ai", tags=["ai"])

    @app.get("/health", tags=["health"])
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
