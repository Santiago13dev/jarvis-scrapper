"""
Configuración centralizada vía variables de entorno (pydantic-settings).
Ningún módulo debe leer os.environ directamente: siempre a través de Settings.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    scraper_results_path: str = "./integrations/google-maps-scraper/results"
    scraper_api_url: str = "http://google-maps-scraper:8080"
    scraper_latitude: float = 4.6534
    scraper_longitude: float = -74.0836

    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
