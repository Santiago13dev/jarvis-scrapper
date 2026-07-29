"""
Configuración del worker ARQ. Se ejecuta con:
    arq app.infrastructure.workers.worker_settings.WorkerSettings

NOTA DE DISEÑO: ARQ necesita que las funciones estén declaradas de forma estática al
arrancar el proceso worker (no dinámicamente desde el proceso API). Por eso cada job
concreto vive en `infrastructure/workers/jobs/*.py` como función top-level e importarse
aquí explícitamente. `QueueProvider.register_worker()` sigue existiendo en el port para
poder testear con un fake/in-memory sin depender de este arranque estático.
"""
from __future__ import annotations

from arq.connections import RedisSettings

from app.infrastructure.config.config import get_settings
from app.infrastructure.workers.jobs.send_campaign_messages_job import send_campaign_messages

settings = get_settings()

functions = [send_campaign_messages]
# TODO: agregar aquí futuros jobs (ej. import_leads_job, analyze_lead_job) a medida
# que se conviertan en operaciones asíncronas de larga duración.


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = functions
    max_jobs = 20
