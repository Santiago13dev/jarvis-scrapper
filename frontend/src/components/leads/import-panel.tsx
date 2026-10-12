"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ImportJob } from "@/types/api";

const STAGES: Record<string, string> = {
  queued: "En cola…",
  searching: "Buscando negocios en Google Maps…",
  importing: "Guardando y calificando negocios…",
  auditing: "Revisando sus páginas web…",
};

const SIZES = [
  { value: 20, label: "20", hint: "≈ 2 min" },
  { value: 50, label: "50", hint: "≈ 4 min" },
  { value: 100, label: "100", hint: "≈ 8 min" },
];

const IDEAS = ["restaurantes", "odontólogos", "veterinarias", "peluquerías", "gimnasios", "abogados", "inmobiliarias", "talleres"];

function minutesSince(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function ImportPanel({
  workspaceId,
  open,
  onOpenChange,
  onFinished,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished: (job: ImportJob) => void;
}) {
  const [form, setForm] = useState({ keyword: "", location: "Bogotá", max_results: 50, extract_emails: false });
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notified = useRef<Set<string>>(new Set());

  const active = jobs.find((job) => job.status === "queued" || job.status === "running") ?? null;
  const last = jobs[0] ?? null;

  const load = useCallback(async () => {
    try {
      const result = await api.get<ImportJob[]>(`/workspaces/${workspaceId}/leads/import-jobs?limit=5`);
      setJobs(result);
      for (const job of result) {
        if ((job.status === "done" || job.status === "failed") && !notified.current.has(job.id)) {
          // Solo se notifica lo que terminó mientras esta pantalla estaba abierta.
          if (notified.current.has(`watch:${job.id}`)) onFinished(job);
          notified.current.add(job.id);
        }
        if (job.status === "queued" || job.status === "running") notified.current.add(`watch:${job.id}`);
      }
    } catch {
      /* el error de red se muestra en la página */
    }
  }, [workspaceId, onFinished]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [active, load]);

  async function submit() {
    setError(null);
    if (form.keyword.trim().length < 2 || form.location.trim().length < 2) {
      setError("Escribe qué negocios buscar y en qué zona.");
      return;
    }
    setSubmitting(true);
    try {
      const job = await api.post<ImportJob>(`/workspaces/${workspaceId}/leads/import-jobs`, form);
      notified.current.add(`watch:${job.id}`);
      setJobs((prev) => [job, ...prev]);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la búsqueda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {(active || (last && minutesSince(last.finished_at) < 10)) && last && (
        <JobStatus job={active ?? last} />
      )}

      <Dialog open={open} onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogTitle>Buscar negocios en Google Maps</DialogTitle>
        <DialogDescription>
          Jarvis busca, guarda y califica cada negocio. Corre en segundo plano: puedes seguir trabajando.
        </DialogDescription>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">¿Qué tipo de negocio?</label>
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-3 focus-within:border-accent/50">
              <Search size={14} className="text-ink-dim" />
              <input
                autoFocus
                value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                placeholder="Ej.: odontólogos"
                className="w-full bg-transparent py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setForm({ ...form, keyword: idea })}
                  className="rounded-full border border-border/40 px-2.5 py-1 text-[11px] text-ink-muted hover:border-accent/40 hover:text-ink"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">¿En qué zona?</label>
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-3 focus-within:border-accent/50">
              <MapPin size={14} className="text-ink-dim" />
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
                placeholder="Ej.: Chapinero, Bogotá"
                className="w-full bg-transparent py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-dim">Mientras más específica la zona (barrio + ciudad), mejores resultados.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">¿Cuántos negocios?</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((size) => (
                <button
                  key={size.value}
                  type="button"
                  onClick={() => setForm({ ...form, max_results: size.value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    form.max_results === size.value ? "border-accent/50 bg-accent/10" : "border-border/40 bg-input hover:border-border",
                  )}
                >
                  <span className="block text-[14px] font-bold text-ink">{size.label}</span>
                  <span className="text-[11px] text-ink-dim">{size.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-input p-3">
            <input
              type="checkbox"
              checked={form.extract_emails}
              onChange={(e) => setForm({ ...form, extract_emails: e.target.checked })}
              className="mt-0.5 accent-[#825aff]"
            />
            <span>
              <span className="block text-[13px] font-medium text-ink">Buscar también correos electrónicos</span>
              <span className="text-[11px] text-ink-dim">Visita la página de cada negocio. Tarda más (aprox. el doble).</span>
            </span>
          </label>

          {error && <p className="rounded-lg bg-red/10 px-3 py-2 text-[12px] text-red">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !!active}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {active ? "Ya hay una búsqueda en curso" : "Buscar negocios"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function JobStatus({ job }: { job: ImportJob }) {
  const running = job.status === "queued" || job.status === "running";
  const failed = job.status === "failed";
  const stageText = running ? STAGES[job.stage ?? job.status] ?? STAGES.queued : failed ? job.error ?? "La búsqueda falló." : "Búsqueda terminada";
  const steps = ["searching", "auditing"];
  const stepIndex = job.status === "done" ? 2 : Math.max(0, steps.indexOf(job.stage ?? ""));

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        failed ? "border-red/30 bg-red/5" : running ? "border-accent/30 bg-accent/5" : "border-teal/30 bg-teal/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Loader2 size={18} className="animate-spin text-accent" />
        ) : failed ? (
          <XCircle size={18} className="text-red" />
        ) : (
          <CheckCircle2 size={18} className="text-teal" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">
            «{job.keyword}» en {job.location}
            {!running && !failed && <span className="font-normal text-ink-muted"> · {job.imported} nuevos{job.skipped ? `, ${job.skipped} ya los tenías` : ""}</span>}
          </p>
          <p className={cn("text-[12px]", failed ? "text-red" : "text-ink-muted")}>
            {stageText}
            {running && job.started_at && ` (${minutesSince(job.started_at)} min)`}
          </p>
        </div>
      </div>
      {running && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {steps.map((step, index) => (
            <div key={step} className={cn("h-1.5 rounded-full", index < stepIndex ? "bg-accent" : index === stepIndex ? "animate-pulse bg-accent/60" : "bg-border/40")} />
          ))}
        </div>
      )}
    </div>
  );
}
