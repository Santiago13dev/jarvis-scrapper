"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCheck, Clock, MessageCircle, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Flag } from "@/components/ui/flag";
import { ScoreRing } from "@/components/ui/score-ring";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { SERVICE_META } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { OutreachActionResult, OutreachDraft, OutreachStatus } from "@/types/api";

const OPENWA_URL = process.env.NEXT_PUBLIC_OPENWA_URL ?? "http://localhost:8090";

const TABS: { key: string; label: string; statuses: OutreachStatus[] }[] = [
  { key: "pending", label: "Por aprobar", statuses: ["pending_approval"] },
  { key: "scheduled", label: "Programados", statuses: ["approved"] },
  { key: "sent", label: "Enviados", statuses: ["sent"] },
  { key: "other", label: "Descartados", statuses: ["rejected", "failed"] },
];

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

function DraftCard({
  draft, selected, onToggle, onSave, onApprove, onReject, onSendManually, busy, assisted,
}: {
  draft: OutreachDraft;
  selected: boolean;
  onToggle: () => void;
  onSave: (message: string) => Promise<void>;
  onApprove: () => void;
  onReject: () => void;
  onSendManually: (message: string) => void;
  busy: boolean;
  assisted: boolean;
}) {
  const [text, setText] = useState(draft.message);
  const [saving, setSaving] = useState(false);
  const editable = draft.status === "pending_approval";
  const service = draft.service ? SERVICE_META[draft.service] : undefined;
  const dirty = text !== draft.message;

  async function save() {
    if (!dirty) return;
    setSaving(true);
    await onSave(text);
    setSaving(false);
  }

  return (
    <article className={cn("flex flex-col rounded-2xl border bg-card transition-colors", selected ? "border-accent/60" : "border-border hover:border-border-light")}>
      <header className="flex items-start gap-3 px-5 pt-5">
        {editable && !assisted && (
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Seleccionar ${draft.lead_name}`} className="mt-3 h-4 w-4 shrink-0 accent-[#39ff88]" />
        )}
        <ScoreRing score={draft.lead_score} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-medium text-ink">{draft.lead_name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-ink-dim">
            <Flag code={draft.lead_country} /> {draft.lead_category ?? "Negocio"} · <span className="tabular-nums">+{draft.to_phone}</span>
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-3 text-[12px] text-ink-muted">
        {service && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: service.color }} /> {service.label}</span>}
        {draft.kind === "follow_up" && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue" /> Seguimiento</span>}
      </div>

      {/* Burbuja tipo WhatsApp, editable mientras está pendiente */}
      <div className="relative mx-5 mt-4 flex-1 rounded-xl rounded-tl-sm bg-white/[0.035] px-4 py-3">
        {editable ? (
          <textarea
            value={text} onChange={(event) => setText(event.target.value)} onBlur={save}
            rows={Math.min(20, text.split("\n").length + Math.ceil(text.length / 48))}
            className="w-full resize-y bg-transparent text-[13px] leading-relaxed text-ink outline-none"
            aria-label="Mensaje"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-muted">{draft.message}</p>
        )}
        {(saving || dirty) && editable && (
          <span className="absolute bottom-2 right-3 text-[11px] text-ink-dim">{saving ? "Guardando…" : "Haz clic fuera para guardar"}</span>
        )}
      </div>

      <footer className="mt-4 flex items-center justify-between gap-2 border-t border-border px-5 py-3.5">
        <span className="text-[12.5px] text-ink-dim">
          {draft.status === "pending_approval" && !assisted && "Puedes editar el texto"}
          {draft.status === "approved" && <span className="flex items-center gap-1.5"><Clock size={13} /> Sale {formatTime(draft.scheduled_for)}</span>}
          {draft.status === "sent" && <span className="flex items-center gap-1.5 text-ink-muted"><Check size={13} className="text-accent" /> Enviado {formatTime(draft.sent_at)}</span>}
          {draft.status === "failed" && <span className="text-red">Falló: {draft.error}</span>}
          {draft.status === "rejected" && (draft.error ?? "Descartado")}
        </span>
        {editable && (
          <div className="flex gap-1.5">
            <button onClick={onReject} disabled={busy} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink disabled:opacity-40">
              Descartar
            </button>
            {assisted ? (
              <button onClick={() => onSendManually(text)} disabled={busy || saving} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink disabled:opacity-40">
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
            ) : (
              <button onClick={onApprove} disabled={busy || saving} className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40">
                Aprobar
              </button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}

export default function ApprovalsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [drafts, setDrafts] = useState<OutreachDraft[] | null>(null);
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [whatsapp, setWhatsapp] = useState<"loading" | "connected" | "disconnected">("loading");
  const [limits, setLimits] = useState<{ daily_send_limit: number; follow_up_days: number; whatsapp_provider: string }>({
    daily_send_limit: 40, follow_up_days: 3, whatsapp_provider: "assisted",
  });
  const assisted = limits.whatsapp_provider === "assisted";

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setDrafts(await api.get<OutreachDraft[]>(`/workspaces/${workspaceId}/automation/outreach?limit=1000`));
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "No se pudieron cargar los mensajes" });
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<{ daily_send_limit: number; follow_up_days: number; whatsapp_provider: string }>(`/workspaces/${workspaceId}/settings`).then(setLimits).catch(() => undefined);
  }, [workspaceId]);

  useEffect(() => {
    fetch(`${OPENWA_URL}/session/main/status`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { status: string }) => setWhatsapp(data.status === "WORKING" ? "connected" : "disconnected"))
      .catch(() => setWhatsapp("disconnected"));
  }, []);

  const current = TABS.find((item) => item.key === tab) ?? TABS[0];
  const visible = useMemo(() => (drafts ?? []).filter((draft) => current.statuses.includes(draft.status)), [drafts, current]);
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((item) => [item.key, (drafts ?? []).filter((draft) => item.statuses.includes(draft.status)).length])),
    [drafts],
  );

  async function approve(ids: string[]) {
    if (!workspaceId || ids.length === 0) return;
    setBusy(true);
    try {
      const result = await api.post<OutreachActionResult>(`/workspaces/${workspaceId}/automation/outreach/approve`, { draft_ids: ids });
      setSelected(new Set());
      setNotice({
        tone: "ok",
        text: result.affected
          ? `${result.affected} mensajes programados. El primero sale ${formatTime(result.first_scheduled_for)} y el último ${formatTime(result.last_scheduled_for)}.`
          : "No había mensajes pendientes para aprobar.",
      });
      await load();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "No se pudo aprobar" });
    } finally {
      setBusy(false);
    }
  }

  async function reject(ids: string[]) {
    if (!workspaceId || ids.length === 0) return;
    setBusy(true);
    try {
      await api.post(`/workspaces/${workspaceId}/automation/outreach/reject`, { draft_ids: ids });
      setSelected(new Set());
      await load();
    } finally {
      setBusy(false);
    }
  }

  /** Modo asistido: abre WhatsApp con el texto listo y registra el envío (y su seguimiento). */
  async function sendManually(draft: OutreachDraft, message: string) {
    if (!workspaceId) return;
    window.open(`https://wa.me/${draft.to_phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    setBusy(true);
    try {
      await api.post(`/workspaces/${workspaceId}/automation/outreach/${draft.id}/sent`);
      setNotice({ tone: "ok", text: `Registrado el envío a ${draft.lead_name}. Si no responde, Jarvis preparará el seguimiento en ${limits.follow_up_days} días.` });
      await load();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "No se pudo registrar el envío" });
    } finally {
      setBusy(false);
    }
  }

  async function saveMessage(id: string, message: string) {
    if (!workspaceId) return;
    await api.patch(`/workspaces/${workspaceId}/automation/outreach/${id}`, { message });
    setDrafts((prev) => prev?.map((draft) => (draft.id === id ? { ...draft, message } : draft)) ?? null);
  }

  const pendingIds = visible.map((draft) => draft.id);
  const selectionIds = selected.size > 0 ? Array.from(selected) : pendingIds;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">Jarvis ya escribió los mensajes</h2>
            {assisted ? (
              <>
                <p className="mt-1 text-[13.5px] text-ink-muted">Revisa, edita si quieres y envíalo desde tu WhatsApp con un toque. Jarvis registra el contacto.</p>
                <p className="mt-3 text-[12.5px] text-ink-dim">
                  Modo asistido: tú envías cada mensaje (sin riesgo de bloqueo) · seguimiento a los {limits.follow_up_days} días si no responden · para envíos automáticos configura OpenWA o la API oficial de Meta
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-[13.5px] text-ink-muted">Revisa, edita si quieres y aprueba. Tú decides cuáles salen.</p>
                <p className="mt-3 text-[12.5px] text-ink-dim">
                  Máx. {limits.daily_send_limit} por día · 1–2,5 min entre envíos · 9:00–19:00 hora local, sin domingos · seguimiento a los {limits.follow_up_days} días si no responden
                </p>
              </>
            )}
          </div>
          {tab === "pending" && pendingIds.length > 0 && !assisted && (
            <div className="flex shrink-0 gap-2">
              <button onClick={() => reject(selectionIds)} disabled={busy} className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-border-light hover:text-ink disabled:opacity-40">
                Descartar {selected.size > 0 ? selected.size : "todos"}
              </button>
              <button onClick={() => approve(selectionIds)} disabled={busy} className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40">
                <CheckCheck size={16} /> Aprobar {selected.size > 0 ? `${selected.size} seleccionados` : `todos (${pendingIds.length})`}
              </button>
            </div>
          )}
        </div>

        {whatsapp === "disconnected" && limits.whatsapp_provider === "openwa" && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber/25 bg-amber/[0.06] px-5 py-3.5 text-[13px] text-ink">
            <span className="flex items-center gap-2.5"><AlertTriangle size={16} className="text-amber" /> Tu WhatsApp no está conectado: los mensajes aprobados no saldrán hasta que lo conectes.</span>
            <Link href="/whatsapp" className="shrink-0 font-medium text-ink underline underline-offset-4">Conectar</Link>
          </div>
        )}

        {notice && (
          <div className={cn("flex items-start justify-between gap-3 rounded-xl border px-5 py-3.5 text-[13px]", notice.tone === "ok" ? "border-border bg-card text-ink" : "border-red/30 bg-red/10 text-red")}>
            <span className="flex items-center gap-2.5">{notice.tone === "ok" && <Check size={16} className="text-accent" />}{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="text-ink-dim hover:text-ink"><X size={15} /></button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-card p-1" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => { setTab(item.key); setSelected(new Set()); }}
                className={cn("flex items-center gap-2 rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors", tab === item.key ? "bg-card-hover text-ink shadow-sm" : "text-ink-dim hover:text-ink")}
              >
                {item.label}
                <span className="tabular-nums text-ink-dim">{counts[item.key] ?? 0}</span>
              </button>
            ))}
          </div>
          {tab === "pending" && pendingIds.length > 0 && !assisted && (
            <button onClick={() => setSelected(selected.size === pendingIds.length ? new Set() : new Set(pendingIds))} className="ml-auto text-[13px] text-ink-muted hover:text-ink">
              {selected.size === pendingIds.length ? "Quitar selección" : "Seleccionar todos"}
            </button>
          )}
        </div>

        {drafts === null ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => <div key={index} className="h-80 animate-pulse rounded-2xl border border-border bg-card" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <CheckCheck size={28} className="mx-auto text-ink-dim" />
            <p className="mt-4 text-[16px] font-semibold text-ink">{tab === "pending" ? "Bandeja al día" : "Nada por aquí todavía"}</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-dim">
              Cuando Jarvis encuentre negocios de alta oportunidad con WhatsApp, sus mensajes aparecerán aquí listos para aprobar.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/leads?buscar=1" className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:bg-accent-hover">Buscar clientes</Link>
              <Link href="/autopilot" className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-light hover:text-ink">Piloto automático</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                busy={busy}
                selected={selected.has(draft.id)}
                onToggle={() => setSelected((prev) => { const next = new Set(prev); next.has(draft.id) ? next.delete(draft.id) : next.add(draft.id); return next; })}
                onSave={(message) => saveMessage(draft.id, message)}
                onApprove={() => approve([draft.id])}
                onReject={() => reject([draft.id])}
                onSendManually={(message) => sendManually(draft, message)}
                assisted={assisted}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
