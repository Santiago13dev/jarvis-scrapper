"""
DEPRECATED: este puerto fue dividido en dos responsabilidades distintas, según feedback
de arquitectura del 2026-07:

1. Persistencia de entidades (Lead, Campaign, Conversation, Template, User, Statistics)
   → ver application/ports/repositories/*.py

2. Almacenamiento de archivos binarios (exportaciones, imágenes)
   → ver application/ports/file_storage_provider.py

Este archivo puede eliminarse manualmente (no cuento con herramienta de borrado de
archivos en este entorno). Se deja como referencia temporal para no romper imports
existentes durante la migración.
"""
from .file_storage_provider import FileStorageProvider as StorageProvider, ExportFormat  # noqa: F401
