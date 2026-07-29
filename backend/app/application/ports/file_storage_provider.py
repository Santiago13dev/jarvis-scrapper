"""
Port: FileStorageProvider

Responsabilidad única: almacenamiento de ARCHIVOS (exportaciones generadas, imágenes de
páginas demo, adjuntos). No confundir con los repositorios de datos (LeadRepository,
CampaignRepository, etc.), que viven en application/ports/repositories/ y representan
persistencia de entidades, no de archivos binarios.
"""
from abc import ABC, abstractmethod
from enum import Enum


class ExportFormat(str, Enum):
    EXCEL = "xlsx"
    CSV = "csv"
    JSON = "json"


class FileStorageProvider(ABC):
    """Puerto que abstrae dónde y cómo se guardan los archivos (disco local, S3, etc.)."""

    @abstractmethod
    async def save_file(self, workspace_id: str, filename: str, content: bytes) -> str:
        """Guarda un archivo arbitrario y devuelve su URL/ruta de acceso."""
        raise NotImplementedError

    @abstractmethod
    async def read_file(self, file_url: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    async def delete_file(self, file_url: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_signed_url(self, file_url: str, expires_in_seconds: int = 3600) -> str:
        """Devuelve una URL temporal de descarga (útil si el backend es S3/GCS)."""
        raise NotImplementedError
