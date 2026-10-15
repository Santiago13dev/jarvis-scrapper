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

from arq import cron
from arq.connections import RedisSettings

from app.infrastructure.config.config import get_settings
from app.infrastructure.workers.jobs.send_campaign_messages_job import send_campaign_messages
from app.infrastructure.workers.jobs.recalculate_lead_scores_job import recalculate_lead_scores
from app.infrastructure.workers.jobs.mark_follow_up_due_job import mark_follow_up_due
from app.infrastructure.workers.jobs.enrich_imported_leads_job import enrich_imported_leads
from app.infrastructure.workers.jobs.send_outreach_draft_job import send_outreach_draft
from app.infrastructure.workers.jobs.autopilot_jobs import (
    autopilot_tick,
    reset_stuck_autopilot_rules,
    run_autopilot_rule,
)

settings = get_settings()

functions = [
    send_campaign_messages,
    recalculate_lead_scores,
    mark_follow_up_due,
    enrich_imported_leads,
    send_outreach_draft,
    run_autopilot_rule,
]
# TODO: agregar aquí futuros jobs (ej. import_leads_job, analyze_lead_job) a medida
# que se conviertan en operaciones asíncronas de larga duración.


class WorkerSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = functions
    max_jobs = 20
    job_timeout = 3 * 3600  # run_autopilot_rule encadena varias búsquedas de Google Maps
    cron_jobs = [cron(autopilot_tick, minute={0, 10, 20, 30, 40, 50}, run_at_startup=True)]
    on_startup = reset_stuck_autopilot_rules
