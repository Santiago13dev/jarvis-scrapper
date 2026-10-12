"""
Configuración centralizada vía variables de entorno (pydantic-settings).
Ningún módulo debe leer os.environ directamente: siempre a través de Settings.
"""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRETS = {"change-me-in-production", "change-me", "secret", "changeme", ""}


class Settings(BaseSettings):
    environment: str = "development"

    database_url: str
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    openwa_base_url: str = ""
    openwa_api_key: str = ""
    # Secreto compartido que OpenWA debe enviar en la cabecera X-Webhook-Secret.
    openwa_webhook_secret: str = ""

    # WhatsApp Business Cloud API (oficial de Meta). Proveedor de envío: "assisted"
    # (Jarvis prepara el mensaje y la persona lo envía), "cloud_api" u "openwa".
    whatsapp_provider: str = "assisted"
    whatsapp_cloud_token: str = ""
    whatsapp_cloud_phone_number_id: str = ""
    whatsapp_cloud_api_version: str = "v21.0"
    whatsapp_cloud_verify_token: str = ""
    whatsapp_cloud_app_secret: str = ""
    # Plantilla aprobada por Meta para el primer contacto (parámetro {{1}} = nombre del negocio).
    whatsapp_cloud_template: str = ""
    whatsapp_cloud_template_lang: str = "es"
    # Workspace que recibe los mensajes entrantes del número oficial.
    whatsapp_cloud_workspace_id: str = ""

    # Si es False, solo se puede crear la primera organización (instalación privada).
    allow_public_registration: bool = True

    scraper_results_path: str = "./integrations/google-maps-scraper/results"
    scraper_api_url: str = "http://google-maps-scraper:8080"
    scraper_latitude: float = 4.6534
    scraper_longitude: float = -74.0836

    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        if self.is_production:
            if self.jwt_secret_key in INSECURE_JWT_SECRETS or len(self.jwt_secret_key) < 32:
                raise ValueError("JWT_SECRET_KEY es inseguro: usa al menos 32 caracteres aleatorios en producción.")
            if not self.openwa_webhook_secret and self.whatsapp_provider == "openwa":
                raise ValueError("Define OPENWA_WEBHOOK_SECRET para usar OpenWA en producción.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
