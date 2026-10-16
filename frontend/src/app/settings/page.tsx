"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Brain, Building2, CheckCircle2, Loader2, MapPinned, MessageCircle, RefreshCw, Save, Send, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Settings {
  name: string;
  business_category: string | null;
  outreach_signature: string;
  daily_send_limit: number;
  follow_up_days: number;
  min_score: number;
  knowledge_base: string | null;
}

interface Integration { key: string; ok: boolean; detail: string }

const TABS: { key: string; label: string; icon: LucideIcon; iconClass: string }[] = [
  { key: "business", label: "Mi negocio", icon: Building2, iconClass: "text-accent" },
  { key: "sending", label: "Envíos", icon: Send, iconClass: "text-orange" },
  { key: "ai", label: "Agente IA", icon: Brain, iconClass: "text-violet" },
  { key: "integrations", label: "Integraciones", icon: Sparkles, iconClass: "text-cyan" },
];

const INTEGRATION_META: Record<string, { label: string; icon: LucideIcon; href?: string; action?: string }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, href: "/whatsapp", action: "Conectar" },
  scraper: { label: "Google Maps", icon: MapPinned },
  worker: { label: "Worker (automatización)", icon: Bot },
  openai: { label: "OpenAI (respuestas con IA)", icon: Brain },
};

const JARVIS_KNOWLEDGE = `Somos Jarvis IA, una agencia que diseña soluciones digitales para que los negocios crezcan con más velocidad y claridad.

Servicios y precios (Colombia):
- Landing Page Profesional: desde $800.000 COP. Diseño responsive, formulario de contacto, botón de WhatsApp, optimización de velocidad.
- Página Web Corporativa: desde $1.500.000 COP. Diseño personalizado, secciones corporativas, SEO base, responsive completo.
- Tienda Virtual: desde $2.200.000 COP. Catálogo, carrito, pasarela de pagos, panel de administración, mobile-first.
- Desarrollo Web a la Medida: desde $3.500.000 COP. Flujos personalizados, automatización, integraciones, soporte técnico.
- Posicionamiento SEO: desde $500.000 COP al mes. SEO técnico, contenidos, keywords, mejoras on-page, monitoreo.
- SEO + Google Ads: desde $800.000 COP al mes. Pauta orientada a conversión, segmentación, optimización y reportes.
- Asistente IA para WhatsApp: desde $1.000.000 COP. Atención 24/7, respuestas automáticas, calificación de leads.

Cuando un cliente pida una propuesta, una reunión o un precio exacto, ofrece agendar una llamada con un asesor.`;

function Slider({ label, hint, value, min, max, step = 1, suffix, onChange, accent }: {
  label: string; hint: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void; accent: string;
}) {
  return (
    <div className="rounded-xl bg-input p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="font-mono text-2xl font-bold text-ink">{value}<span className="ml-1 text-[12px] font-normal text-ink-dim">{suffix}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} className={cn("mt-3 w-full", accent)} />
      <p className="mt-1 text-[11px] text-ink-dim">{hint}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [tab, setTab] = useState("business");
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);

  const base = workspaceId ? `/workspaces/${workspaceId}/settings` : null;

  const loadIntegrations = useCallback(async () => {
    if (!base) return;
    setIntegrations(null);
    try { setIntegrations(await api.get<Integration[]>(`${base}/integrations`)); } catch { setIntegrations([]); }
  }, [base]);

  useEffect(() => {
    if (!base) return;
    api.get<Settings>(base).then((data) => { setSaved(data); setForm(data); }).catch((err) => setMessage({ tone: "error", text: err.message }));
    loadIntegrations();
  }, [base, loadIntegrations]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(form), [saved, form]);

  async function save() {
    if (!base || !form) return;
    setSaving(true); setMessage(null);
    try {
      const data = await api.put<Settings>(base, form);
      setSaved(data); setForm(data);
      setMessage({ tone: "ok", text: "Cambios guardados. Jarvis ya trabaja con la nueva configuración." });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "No se pudo guardar" });
    } finally { setSaving(false); }
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <AppShell>
      <div className="grid gap-5 pb-24 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Secciones de configuración">
          {TABS.map(({ key, label, icon: Icon, iconClass }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors", tab === key ? "bg-white/[0.06] text-ink" : "text-ink-muted hover:bg-white/[0.03] hover:text-ink")}>
              <Icon size={16} className={tab === key ? iconClass : "text-ink-dim"} /> {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {message && (
            <div className={cn("rounded-xl border px-4 py-3 text-[12px]", message.tone === "ok" ? "border-accent/30 bg-accent/10 text-ink" : "border-red/30 bg-red/10 text-red")}>{message.text}</div>
          )}

          {!form ? (
            <div className="h-64 animate-pulse rounded-2xl border border-border/40 bg-card/60" />
          ) : tab === "business" ? (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-7">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">Mi negocio</h2>
                <p className="text-[12px] text-ink-muted">Cómo te presentas ante tus clientes.</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-muted">Nombre del workspace</span>
                <input value={form.name} onChange={(event) => set("name", event.target.value)}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-[14px] text-ink outline-none focus:border-border-light" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-muted">Rubro de tu negocio</span>
                <input value={form.business_category ?? ""} onChange={(event) => set("business_category", event.target.value)} maxLength={100}
                  placeholder="Ej: Agencia de marketing digital"
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-dim focus:border-border-light" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-muted">Firma de tus mensajes</span>
                <input value={form.outreach_signature} onChange={(event) => set("outreach_signature", event.target.value)} maxLength={120}
                  className="w-full rounded-lg border border-border bg-input px-4 py-3 text-[14px] text-ink outline-none focus:border-border-light" />
              </label>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-muted">Así termina cada mensaje</p>
                <div className="max-w-md rounded-2xl rounded-tl-sm border border-wa/25 bg-wa/[0.07] p-4 text-[13px] leading-relaxed text-ink">
                  …¿Le puedo mostrar un ejemplo sin ningún compromiso?<br /><br />
                  <span className="text-ink-muted">Si no le interesa, responda NO y no le vuelvo a escribir.</span><br /><br />
                  <span className="font-semibold">{form.outreach_signature || "—"}</span>
                </div>
              </div>
            </section>
          ) : tab === "sending" ? (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-7">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">Envíos y seguimiento</h2>
                <p className="text-[12px] text-ink-muted">Cuántos mensajes salen y cuándo Jarvis vuelve a escribir.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Slider label="Límite diario" suffix="msj/día" value={form.daily_send_limit} min={5} max={100} step={5} accent="accent-[#ff9240]"
                  hint={form.daily_send_limit > 50 ? "⚠️ Más de 50 al día aumenta el riesgo de bloqueo con WhatsApp Web." : "Recomendado: 30–50 para cuidar tu número."}
                  onChange={(value) => set("daily_send_limit", value)} />
                <Slider label="Seguimiento" suffix="días" value={form.follow_up_days} min={1} max={14} accent="accent-[#529cff]"
                  hint="Si no responden, Jarvis prepara un segundo mensaje tras estos días." onChange={(value) => set("follow_up_days", value)} />
                <Slider label="Puntaje mínimo" suffix="pts" value={form.min_score} min={40} max={95} step={5} accent="accent-[#39ff88]"
                  hint="Solo se escribe automáticamente a leads con este puntaje o más." onChange={(value) => set("min_score", value)} />
              </div>
            </section>
          ) : tab === "ai" ? (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-ink">Agente IA</h2>
                  <p className="max-w-xl text-[12px] text-ink-muted">Lo que el asistente sabe para responder a los clientes que contestan. Si algo no está aquí, pasa la conversación a una persona: nunca inventa.</p>
                </div>
                <button onClick={() => set("knowledge_base", JARVIS_KNOWLEDGE)} className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-[13px] font-medium text-ink hover:border-border-light">
                  <Sparkles size={14} /> Usar mis servicios de Jarvis IA
                </button>
              </div>
              <textarea value={form.knowledge_base ?? ""} onChange={(event) => set("knowledge_base", event.target.value)} rows={16}
                placeholder="Describe tus servicios, precios, horarios, preguntas frecuentes…"
                className="w-full resize-y rounded-lg border border-border bg-input px-4 py-3 text-[13px] leading-relaxed text-ink outline-none focus:border-border-light" />
              <p className="text-[11px] text-ink-dim">{(form.knowledge_base ?? "").length.toLocaleString("es-CO")} / 20.000 caracteres</p>
            </section>
          ) : (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-ink">Integraciones</h2>
                  <p className="text-[12px] text-ink-muted">Estado en vivo de todo lo que hace funcionar a Jarvis.</p>
                </div>
                <button onClick={loadIntegrations} className="flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-[13px] text-ink-muted hover:border-border-light hover:text-ink"><RefreshCw size={14} /> Revisar</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {integrations === null
                  ? [0, 1, 2, 3].map((index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-border/40 bg-input" />)
                  : integrations.map((item) => {
                      const meta = INTEGRATION_META[item.key] ?? { label: item.key, icon: Sparkles };
                      const Icon = meta.icon;
                      return (
                        <div key={item.key} className="flex items-start gap-4 rounded-xl bg-input p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-ink-muted"><Icon size={18} /></span>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                              {meta.label} {item.ok ? <CheckCircle2 size={14} className="text-accent" /> : <XCircle size={14} className="text-amber" />}
                            </p>
                            <p className="mt-0.5 text-[12px] text-ink-muted">{item.detail}</p>
                            {!item.ok && meta.href && <Link href={meta.href} className="mt-2 inline-block text-[12.5px] font-medium text-ink underline underline-offset-4">{meta.action}</Link>}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Barra de guardado: aparece solo si hay cambios */}
      {dirty && (
        <div className="rise-in fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border-light bg-card-hover/95 p-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl lg:bottom-6 lg:left-64">
          <span className="px-2 text-[13px] text-ink">Tienes cambios sin guardar</span>
          <button onClick={() => setForm(saved)} className="ml-auto rounded-xl px-3 py-2 text-[12px] text-ink-muted hover:text-ink">Descartar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </div>
      )}
    </AppShell>
  );
}
