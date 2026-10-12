"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Info, Loader2, SkipForward, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PresenceBadge, Rating, ScoreBadge, WhatsAppIcon } from "@/components/leads/lead-badges";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { cityOf, formatPhone } from "@/lib/leads";
import { cn } from "@/lib/utils";
import type { FollowUp, Lead, MessageTemplate, OutreachItem } from "@/types/api";

const MAX_ATTEMPTS = 3;

function followUpMessage(lead: Lead) {
  return `Hola, ¿cómo vas? Te escribí hace unos días sobre ${lead.name}. ¿Pudiste verlo? Si te sirve, te muestro en 2 minutos cómo podrías conseguir más clientes desde internet. 🙌`;
}

function waUrl(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export default function OutreachPage() {
  const { workspaceId } = useActiveWorkspace();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [minScore, setMinScore] = useState(40);
  const [queue, setQueue] = useState<OutreachItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [doneToday, setDoneToday] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leadsById, setLeadsById] = useState<Record<string, Lead>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const notify = (text: string, tone: "ok" | "error" = "ok") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 5000);
  };

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const params = new URLSearchParams({ limit: "20", min_score: String(minScore) });
    if (templateId) params.set("template_id", templateId);
    try {
      const [items, pending, leads] = await Promise.all([
        api.get<OutreachItem[]>(`/workspaces/${workspaceId}/leads/outreach-queue?${params}`),
        api.get<FollowUp[]>(`/workspaces/${workspaceId}/follow-ups`),
        api.get<Lead[]>(`/workspaces/${workspaceId}/leads?limit=5000`),
      ]);
      setQueue(items);
      setDrafts(Object.fromEntries(items.map((item) => [item.lead_id, item.message])));
      setFollowUps(pending);
      setLeadsById(Object.fromEntries(leads.map((lead) => [lead.id, lead])));
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo cargar la lista.", "error");
    }
  }, [workspaceId, minScore, templateId]);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<MessageTemplate[]>(`/workspaces/${workspaceId}/templates/messages`).then(setTemplates).catch(() => setTemplates([]));
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => (queue ?? []).filter((item) => !doneToday.includes(item.lead_id) && !skipped.has(item.lead_id)),
    [queue, doneToday, skipped],
  );
  const dueFollowUps = useMemo(
    () => followUps.filter((f) => new Date(f.next_follow_up_at).getTime() <= Date.now() + 12 * 3600 * 1000 && leadsById[f.lead_id]?.whatsapp),
    [followUps, leadsById],
  );
  const total = (queue?.length ?? 0) - skipped.size;

  async function send(item: OutreachItem) {
    if (!workspaceId) return;
    // Se abre la ventana en el mismo clic (si no, el navegador la bloquea como emergente).
    window.open(waUrl(item.whatsapp, drafts[item.lead_id] ?? item.message), "_blank", "noopener,noreferrer");
    setBusy(item.lead_id);
    try {
      await api.post(`/workspaces/${workspaceId}/leads/${item.lead_id}/contacted`, { channel: "whatsapp", follow_up_in_days: 3 });
      setDoneToday((prev) => [...prev, item.lead_id]);
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo registrar el contacto.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function doNotContact(leadId: string) {
    if (!workspaceId) return;
    setBusy(leadId);
    try {
      await api.patch(`/workspaces/${workspaceId}/leads/${leadId}/status`, { status: "lost", do_not_contact: true });
      setSkipped((prev) => new Set(prev).add(leadId));
      notify("Listo, no volverá a aparecer.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo actualizar.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function sendFollowUp(followUp: FollowUp) {
    if (!workspaceId) return;
    const lead = leadsById[followUp.lead_id];
    if (!lead?.whatsapp) return;
    window.open(waUrl(lead.whatsapp, followUpMessage(lead)), "_blank", "noopener,noreferrer");
    setBusy(followUp.id);
    try {
      await api.patch(`/workspaces/${workspaceId}/follow-ups/${followUp.id}/complete`);
      const nextAttempt = lead.contact_attempts + 1 < MAX_ATTEMPTS;
      await api.post(`/workspaces/${workspaceId}/leads/${lead.id}/contacted`, { channel: "whatsapp", follow_up_in_days: nextAttempt ? 4 : null });
      setFollowUps((prev) => prev.filter((item) => item.id !== followUp.id));
      notify(nextAttempt ? "Seguimiento enviado. Próximo recordatorio en 4 días." : "Último seguimiento enviado. Si no responde, quedará en pausa.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo registrar el seguimiento.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function dismissFollowUp(followUp: FollowUp) {
    if (!workspaceId) return;
    setBusy(followUp.id);
    try {
      await api.patch(`/workspaces/${workspaceId}/follow-ups/${followUp.id}/cancel`, { reason: "cancelled_by_user" });
      setFollowUps((prev) => prev.filter((item) => item.id !== followUp.id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Contactar hoy</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">Tus mejores prospectos con el mensaje listo. Revisa, ajusta si quieres y envía con un toque.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card px-4 py-2 text-center">
            <p className="font-mono text-xl font-bold text-ink">{doneToday.length}<span className="text-ink-dim">/{Math.max(total, 0)}</span></p>
            <p className="text-[11px] text-ink-muted">contactados hoy</p>
          </div>
        </div>

        {notice && (
          <div className={cn("flex items-center justify-between rounded-xl border px-4 py-3 text-[13px]", notice.tone === "ok" ? "border-teal/30 bg-teal/10 text-teal" : "border-red/30 bg-red/10 text-red")}>
            <span className="flex items-center gap-2">{notice.tone === "ok" && <CheckCircle2 size={15} />}{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-blue/25 bg-blue/5 px-4 py-3 text-[12px] text-ink-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-blue" />
          <p>
            Los mensajes se envían desde <strong className="text-ink">tu WhatsApp</strong>, uno por uno: así tu número no corre riesgo de bloqueo y cada mensaje se siente personal.
            Si alguien responde «no me interesa», márcalo como <em>No contactar</em> y no volverá a aparecer.
          </p>
        </div>

        {/* Configuración */}
        <div className="grid gap-3 rounded-xl border border-border/40 bg-card p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-dim">Mensaje</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full rounded-lg border border-border/50 bg-input px-3 py-2 text-[13px] text-ink outline-none">
              <option value="">Mensaje recomendado de Jarvis</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-dim">Potencial mínimo</span>
            <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-full rounded-lg border border-border/50 bg-input px-3 py-2 text-[13px] text-ink outline-none">
              <option value={0}>Todos</option>
              <option value={40}>Medio o alto (40+)</option>
              <option value={70}>Solo alto (70+)</option>
            </select>
          </label>
        </div>

        {/* Seguimientos vencidos */}
        {dueFollowUps.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink"><CalendarClock size={15} className="text-amber" /> Seguimientos para hoy ({dueFollowUps.length})</h2>
            {dueFollowUps.map((followUp) => {
              const lead = leadsById[followUp.lead_id];
              return (
                <div key={followUp.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3">
                  <ScoreBadge score={lead.lead_score} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{lead.name}</p>
                    <p className="text-[12px] text-ink-muted">Intento {lead.contact_attempts + 1} de {MAX_ATTEMPTS} · le escribiste el {new Date(lead.last_contacted_at ?? followUp.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</p>
                  </div>
                  <Button variant="ghost" disabled={busy === followUp.id} onClick={() => void dismissFollowUp(followUp)}>Omitir</Button>
                  <button
                    disabled={busy === followUp.id}
                    onClick={() => void sendFollowUp(followUp)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-[12px] font-semibold text-[#06210f] hover:bg-[#2ee26f] disabled:opacity-50"
                  >
                    <WhatsAppIcon size={14} /> Hacer seguimiento
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* Lista del día */}
        {queue === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-ink-muted"><Loader2 size={16} className="animate-spin" /> Preparando tu lista…</div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal/15 text-teal"><Sparkles size={20} /></div>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">{doneToday.length > 0 ? "¡Terminaste la lista de hoy!" : "No hay prospectos pendientes"}</h2>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
              {doneToday.length > 0
                ? `Contactaste ${doneToday.length} negocios. Te avisaremos aquí cuando toque hacerles seguimiento.`
                : "Busca más negocios en Leads o baja el potencial mínimo para ver más."}
            </p>
            <Link href="/leads" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover">Ir a Leads</Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {pending.map((item, index) => (
              <li key={item.lead_id} className="rounded-xl border border-border/40 bg-card p-4">
                <div className="flex items-start gap-3">
                  <ScoreBadge score={item.lead_score} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-ink-dim">#{index + 1}{item.contact_attempts > 0 ? ` · ya le escribiste ${item.contact_attempts} ${item.contact_attempts === 1 ? "vez" : "veces"}` : ""}</p>
                    <h3 className="truncate font-semibold text-ink">{item.name}</h3>
                    <p className="truncate text-[12px] text-ink-dim">{[item.category, cityOf(item.address), formatPhone(item.whatsapp)].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <PresenceBadge lead={{ website: item.website, instagram: item.instagram, facebook: null, listing_url: null, tags: [] }} />
                      <Rating rating={item.rating} reviews={item.reviews_count} />
                    </div>
                  </div>
                </div>
                <textarea
                  value={drafts[item.lead_id] ?? item.message}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [item.lead_id]: e.target.value }))}
                  rows={4}
                  aria-label={`Mensaje para ${item.name}`}
                  className="mt-3 w-full resize-y rounded-lg border border-border/50 bg-input px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-accent/50"
                />
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="ghost" disabled={busy === item.lead_id} onClick={() => void doNotContact(item.lead_id)} className="text-red hover:text-red">
                    <Ban size={13} /> No contactar
                  </Button>
                  <Button variant="secondary" onClick={() => setSkipped((prev) => new Set(prev).add(item.lead_id))}>
                    <SkipForward size={13} /> Saltar
                  </Button>
                  <button
                    disabled={busy === item.lead_id}
                    onClick={() => void send(item)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-[13px] font-semibold text-[#06210f] transition-colors hover:bg-[#2ee26f] disabled:opacity-50"
                  >
                    {busy === item.lead_id ? <Loader2 size={15} className="animate-spin" /> : <WhatsAppIcon size={15} />} Abrir WhatsApp
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppShell>
  );
}
