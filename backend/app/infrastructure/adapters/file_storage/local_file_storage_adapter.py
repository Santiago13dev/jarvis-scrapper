"""
Adapter: LocalFileStorageAdapter — implementa FileStorageProvider guardando en disco
local. Reemplazable por un adapter S3/GCS sin tocar casos de uso (mismo port).
"""
from __future__ import annotations

from pathlib import Path

from app.application.ports.file_storage_provider import FileStorageProvider

_BASE_DIR = Path("storage")


class LocalFileStorageAdapter(FileStorageProvider):
    def __init__(self, base_dir: str | Path = _BASE_DIR) -> None:
        self._base_dir = Path(base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_path(self, workspace_id: str, filename: str) -> Path:
        workspace_dir = self._base_dir / workspace_id
        workspace_dir.mkdir(parents=True, exist_ok=True)
        return workspace_dir / filename

    async def save_file(self, workspace_id: str, filename: str, content: bytes) -> str:
        path = self._resolve_path(workspace_id, filename)
        path.write_bytes(content)
        return str(path)

    async def read_file(self, file_url: str) -> bytes:
        return Path(file_url).read_bytes()

    async def delete_file(self, file_url: str) -> None:
        path = Path(file_url)
        if path.exists():
            path.unlink()

    async def get_signed_url(self, file_url: str, expires_in_seconds: int = 3600) -> str:
        # Disco local no soporta URLs firmadas reales; se devuelve la ruta tal cual.
        # Un adapter S3 real implementaría esto con `generate_presigned_url`.
        return file_url
