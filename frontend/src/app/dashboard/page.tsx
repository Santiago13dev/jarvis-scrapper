"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Check, CheckCheck, Loader2, MessageCircle, PenLine, Phone, Search, Send, Target, Trophy, Users, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { JarvisSearch } from "@/components/search/jarvis-search";
import { Flag } from "@/components/ui/flag";
import { JarvisOrb } from "@/components/ui/jarvis-orb";
import { Panel, PanelLink, Stat } from "@/components/ui/panel";
import { ScoreRing } from "@/components/ui/score-ring";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { COUNTRY_META, SERVICE_META } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { DashboardOverview, OutreachActionResult } from "@/types/api";

interface Integration { key: string; ok: boolean; detail: string }

const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: "new", label: "Nuevos" },
  { key: "contacted", label: "Contactados" },
  { key: "replied", label: "Respondieron" },
  { key: "qualified", label: "Calificados" },
  { key: "demo_sent", label: "Demo enviada" },
  { key: "won", label: "Ganados" },
];

function jarvisSays(data: DashboardOverview): string {
  if (data.total_leads === 0) return "Todavía no tienes clientes potenciales. Dime qué negocios buscamos y en qué ciudad.";
  if (data.pending_approvals > 0) return `Tengo ${data.pending_approvals} mensajes escritos esperando tu aprobación.`;
  if (data.replied > 0) return `${data.replied} clientes respondieron. Es momento de cerrar esas ventas.`;
  if (data.autopilot.active_rules === 0) return "Activa el piloto automático y te traigo clientes nuevos cada día.";
  return "Todo al día. Sigo buscando clientes nuevos por ti.";
}

/** Meta del día: mensajes enviados frente al límite seguro configurado. */
function DailyGoal({ sent, limit, scheduled }: { sent: number; limit: number; scheduled: number }) {
  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, sent / Math.max(1, limit));
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="stroke-white/[0.06]" />
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} className="stroke-accent transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-[28px] font-semibold leading-none text-ink">{sent}</span>
          <span className="mt-1 text-[11px] text-ink-dim">de {limit}</span>
        </div>
      </div>
      <dl className="space-y-3 text-[13px]">
        <div><dt className="text-ink-dim">Programados</dt><dd className="font-semibold text-ink">{scheduled} mensajes</dd></div>
        <div><dt className="text-ink-dim">Cupos libres hoy</dt><dd className="font-semibold text-ink">{Math.max(0, limit - sent)}</dd></div>
      </dl>
    </div>
  );
}

type Activity = DashboardOverview["activity"][number];

const ACTIVITY_META: Record<Activity["kind"], { icon: LucideIcon; tone: string; text: (item: Activity) => string }> = {
  found: { icon: Search, tone: "text-cyan bg-cyan/10", text: (item) => `Encontró ${item.count} ${item.count === 1 ? "negocio" : "negocios"}${item.detail ? ` · ${item.detail}` : ""}` },
  drafted: { icon: PenLine, tone: "text-amber bg-amber/10", text: (item) => `Escribió ${item.count} ${item.count === 1 ? "mensaje" : "mensajes"} para que los apruebes` },
  sent: { icon: Send, tone: "text-accent bg-accent/10", text: (item) => `Envió ${item.count} ${item.count === 1 ? "mensaje" : "mensajes"} por WhatsApp` },
  replied: { icon: MessageCircle, tone: "text-blue bg-blue/10", text: (item) => `${item.detail ?? "Un cliente"} respondió` },
};

function timeAgo(value: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "hace un momento";
}

/** Barras diminutas de los últimos 14 días: tendencia de un vistazo, sin ejes. */
function MiniBars({ values }: { values: { date: string; count: number }[] }) {
  const max = Math.max(1, ...values.map((item) => item.count));
  return (
    <div className="mt-3 flex h-8 items-end gap-[3px]" aria-hidden>
      {values.map((item) => (
        <span
          key={item.date}
          title={`${new Date(`${item.date}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}: ${item.count}`}
          className={cn("flex-1 rounded-sm", item.count ? "bg-accent" : "bg-white/[0.07]")}
          style={{ height: `${item.count ? Math.max(14, (item.count / max) * 100) : 14}%`, opacity: item.count ? 0.35 + (item.count / max) * 0.65 : 1 }}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { workspaceId } = useActiveWorkspace();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<Record<string, "loading" | "done" | "skip">>({});

  const load = useCallback(() => {
    if (!workspaceId) return;
    api.get<DashboardOverview>(`/workspaces/${workspaceId}/dashboard/overview`).then(setData).catch((err) => setError(err.message));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    load();
    api.get<Integration[]>(`/workspaces/${workspaceId}/settings/integrations`).then(setIntegrations).catch(() => undefined);
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, [workspaceId, load]);

  async function draftFor(leadId: string) {
    if (!workspaceId) return;
    setDrafting((prev) => ({ ...prev, [leadId]: "loading" }));
    try {
      const result = await api.post<OutreachActionResult>(`/workspaces/${workspaceId}/automation/outreach/draft`, { lead_ids: [leadId], min_score: 0 });
      setDrafting((prev) => ({ ...prev, [leadId]: result.affected ? "done" : "skip" }));
      load();
    } catch {
      setDrafting((prev) => ({ ...prev, [leadId]: "skip" }));
    }
  }

  const services = useMemo(
    () => Object.entries(SERVICE_META).map(([key, meta]) => ({ key, ...meta, count: data?.by_service[key] ?? 0 })).filter((item) => item.count > 0),
    [data],
  );
  const maxService = Math.max(1, ...services.map((item) => item.count));
  const maxPipeline = Math.max(1, ...PIPELINE_STEPS.map((item) => data?.pipeline[item.key] ?? 0));

  const whatsappOk = integrations.find((item) => item.key === "whatsapp")?.ok ?? false;
  const onboarding = data
    ? [
        { done: whatsappOk, label: "Conecta tu WhatsApp", hint: "Para enviar los mensajes desde tu número", href: "/whatsapp" },
        { done: data.total_leads > 0, label: "Haz tu primera búsqueda", hint: "Rubro y ciudad, en cualquier país", href: "/leads?buscar=1" },
        { done: data.autopilot.active_rules > 0, label: "Activa el piloto automático", hint: "Clientes nuevos cada día, solos", href: "/autopilot" },
        { done: data.sent_last_30_days > 0, label: "Aprueba tus primeros mensajes", hint: "Un clic y empiezan a salir", href: "/approvals" },
      ]
    : [];
  const completed = onboarding.filter((item) => item.done).length;

  return (
    <AppShell>
      <div className="space-y-6">
        {error && <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-[13px] text-red">{error}</div>}

        {/* Jarvis habla */}
        <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-accent/20 bg-card px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <JarvisOrb className="w-12 shrink-0" state={data?.autopilot.running_rules ? "thinking" : "idle"} />
            <div>
              <p className="text-[12px] font-medium text-accent neon-text">Jarvis</p>
              <p className="text-[16px] font-medium text-ink">{data ? jarvisSays(data) : "Revisando tu workspace…"}</p>
            </div>
          </div>
          {!!data?.pending_approvals && (
            <Link href="/approvals" className="relative flex shrink-0 items-center gap-2 self-start rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink sm:self-auto">
              <CheckCheck size={16} /> Revisar {data.pending_approvals} mensajes
            </Link>
          )}
        </div>

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat icon={Users} label="Leads" value={data?.total_leads ?? 0} tone="green" href="/leads" hint={data ? `+${data.new_last_7_days} esta semana` : undefined} />
          <Stat icon={Target} label="Oportunidad alta" value={data?.high_opportunity ?? 0} tone="cyan" href="/leads?filtro=alta" />
          <Stat icon={Phone} label="Con WhatsApp" value={data?.with_whatsapp ?? 0} tone="wa" href="/leads?filtro=whatsapp" />
          <Stat icon={CheckCheck} label="Por aprobar" value={data?.pending_approvals ?? 0} tone="amber" href="/approvals" />
          <Stat icon={MessageCircle} label="Respondieron" value={data?.replied ?? 0} tone="blue" href="/conversations" />
          <Stat icon={Trophy} label="Ganados" value={data?.won ?? 0} tone="green" href="/leads?estado=won" />
        </div>

        <JarvisSearch workspaceId={workspaceId} onDone={load} />

        {/* Primeros pasos: desaparece cuando todo está hecho */}
        {data && completed < onboarding.length && (
          <Panel title="Primeros pasos" description={`${completed} de ${onboarding.length} completados`}
            action={<div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${(completed / onboarding.length) * 100}%` }} /></div>}>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              {onboarding.map((item, index) => (
                <Link key={item.label} href={item.href} className="group flex items-start gap-3 bg-card p-4 transition-colors hover:bg-card-hover">
                  <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", item.done ? "bg-accent text-accent-ink" : "border border-border-light text-ink-muted")}>
                    {item.done ? <Check size={13} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[13.5px] font-medium", item.done ? "text-ink-dim line-through" : "text-ink")}>{item.label}</span>
                    <span className="block text-[12px] text-ink-dim">{item.hint}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Actividad de Jarvis" description="Lo que hizo por ti en los últimos 14 días" className="xl:col-span-2" bodyClassName="px-0 pb-2">
            <div className="grid grid-cols-2 gap-px border-y border-border bg-border md:grid-cols-4">
              {[
                { label: "Leads encontrados", value: data?.last_14_days.leads ?? 0, extra: <MiniBars values={data?.leads_per_day ?? []} /> },
                { label: "Mensajes escritos", value: data?.last_14_days.drafted ?? 0 },
                { label: "Enviados", value: data?.last_14_days.sent ?? 0 },
                { label: "Respuestas", value: data?.last_14_days.replies ?? 0 },
              ].map((item) => (
                <div key={item.label} className="bg-card px-6 py-4">
                  <p className="text-[12.5px] text-ink-dim">{item.label}</p>
                  <p className="mt-1 font-display text-[26px] font-semibold leading-none text-ink">{item.value.toLocaleString("es-CO")}</p>
                  {item.extra}
                </div>
              ))}
            </div>
            {data && data.activity.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-ink-dim">Aquí verás cada búsqueda, mensaje y respuesta en cuanto Jarvis empiece a trabajar.</p>
            ) : (
              <ol className="px-6 pt-2">
                {(data?.activity ?? []).map((item, index) => {
                  const meta = ACTIVITY_META[item.kind];
                  const Icon = meta.icon;
                  const last = index === (data?.activity.length ?? 0) - 1;
                  return (
                    <li key={`${item.kind}-${item.at}-${index}`} className="relative flex gap-4 py-3">
                      {!last && <span className="absolute left-[15px] top-11 h-[calc(100%-32px)] w-px bg-border" />}
                      <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.tone)}><Icon size={15} /></span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="flex items-center gap-1.5 text-[13.5px] text-ink">
                          <span className="truncate">{meta.text(item)}</span>
                          {item.country && <Flag code={item.country} />}
                        </p>
                        <p className="text-[12px] text-ink-dim">{timeAgo(item.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Meta de hoy" description="Mensajes enviados frente a tu límite seguro" action={<PanelLink href="/approvals">Aprobar</PanelLink>}>
            <DailyGoal sent={data?.sent_today ?? 0} limit={data?.daily_send_limit ?? 40} scheduled={data?.scheduled_messages ?? 0} />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Panel title="Embudo de ventas" description="Toca una etapa para ver esos leads">
            <div className="-mx-2 space-y-0.5">
              {PIPELINE_STEPS.map((item) => {
                const count = data?.pipeline[item.key] ?? 0;
                return (
                  <Link key={item.key} href={`/leads?estado=${item.key}`}
                    className="grid grid-cols-[minmax(0,1fr)_120px_32px] items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-white/[0.03]">
                    <span className="text-ink-muted">{item.label}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className={cn("h-full rounded-full transition-all duration-700", item.key === "won" ? "bg-accent" : "bg-ink-muted/60")} style={{ width: `${(count / maxPipeline) * 100}%` }} />
                    </div>
                    <span className="text-right font-medium tabular-nums text-ink">{count}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel title="Qué vender" description="Servicio recomendado por Jarvis">
            {services.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-ink-dim">Aparecerá cuando Jarvis puntúe tus leads.</p>
            ) : (
              <div className="-mx-2 space-y-0.5">
                {services.map((item) => (
                  <Link key={item.key} href={`/leads?servicio=${item.key}`} title={`${item.label}: ${item.count} leads`}
                    className="grid grid-cols-[minmax(0,1fr)_88px_32px] items-center gap-3 rounded-lg px-2 py-2 text-[13px] transition-colors hover:bg-white/[0.03]">
                    <span className="flex items-center gap-2 truncate text-ink-muted">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: item.color }} />{item.label}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.count / maxService) * 100}%`, background: item.color }} />
                    </div>
                    <span className="text-right font-medium tabular-nums text-ink">{item.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Mercados" description="Leads por país">
            <div className="-mx-2 space-y-0.5">
              {Object.entries(COUNTRY_META).map(([code, meta]) => (
                <Link key={code} href={`/leads?pais=${code}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-[13px] transition-colors hover:bg-white/[0.03]">
                  <Flag code={code} className="text-[18px]" />
                  <span className="flex-1 text-ink-muted">{meta.name}</span>
                  <span className="font-medium tabular-nums text-ink">{data?.by_country[code] ?? 0}</span>
                </Link>
              ))}
            </div>
            <Link href="/leads?buscar=1" className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-border-light hover:text-ink">
              Buscar en otro país <ArrowRight size={14} />
            </Link>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="A quién escribirle primero" description="Las mejores oportunidades que aún no contactas" className="xl:col-span-2" action={<PanelLink href="/leads?filtro=alta">Ver todas</PanelLink>} bodyClassName="px-0 pb-2">
            {data && data.top_opportunities.length === 0 ? (
              <p className="px-6 py-8 text-center text-[13px] text-ink-dim">Haz una búsqueda y Jarvis te mostrará aquí a quién contactar primero.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(data?.top_opportunities ?? []).map((lead) => {
                  const service = lead.service ? SERVICE_META[lead.service] : undefined;
                  const state = drafting[lead.id];
                  return (
                    <li key={lead.id} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-white/[0.02]">
                      <ScoreRing score={lead.score} size={40} />
                      <Link href={`/leads?lead=${lead.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink hover:underline">{lead.name}</p>
                        <p className="flex items-center gap-1.5 truncate text-[12px] text-ink-dim">
                          <Flag code={lead.country} /> {lead.category ?? "Negocio"}
                          {service && <><span className="text-border-light">·</span><span className="h-1.5 w-1.5 rounded-full" style={{ background: service.color }} />{service.label}</>}
                        </p>
                      </Link>
                      {lead.has_whatsapp && (
                        <button onClick={() => draftFor(lead.id)} disabled={!!state} title="Que Jarvis le escriba"
                          className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                            state === "done" ? "text-accent" : state === "skip" ? "text-ink-dim" : "border border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                          {state === "loading" ? <Loader2 size={14} className="animate-spin" /> : state === "done" ? <><Check size={14} /> Escrito</> : state === "skip" ? "Ya tiene" : <><PenLine size={14} /> Escribir</>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Piloto automático" description="Búsquedas que corren solas" action={<PanelLink href="/autopilot">Configurar</PanelLink>}>
            {data?.autopilot.running ? (
              <Link href="/autopilot" className="block">
                <div className="flex items-center gap-3">
                  <Loader2 size={17} className="shrink-0 animate-spin text-violet" />
                  <p className="min-w-0 text-[14px] font-medium text-ink">
                    {data.autopilot.running.stage === "enriching"
                      ? "Revisando webs y escribiendo mensajes"
                      : `Búsqueda ${Math.min(data.autopilot.running.current + 1, data.autopilot.running.total)} de ${data.autopilot.running.total}`}
                  </p>
                </div>
                {data.autopilot.running.keyword && (
                  <p className="mt-1 truncate pl-7 text-[12.5px] text-ink-muted">
                    <span className="capitalize">{data.autopilot.running.keyword}</span> en {data.autopilot.running.location}
                  </p>
                )}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-violet transition-all duration-700"
                    style={{ width: `${Math.max(4, ((data.autopilot.running.current + (data.autopilot.running.stage === "enriching" ? 0.5 : 0)) / (data.autopilot.running.total + 1)) * 100)}%` }} />
                </div>
                <p className="mt-2 text-[12.5px] text-ink-dim">
                  <span className="font-semibold text-ink">{data.autopilot.running.new_leads}</span> negocios nuevos hasta ahora · {data.autopilot.running.rule_name}
                </p>
              </Link>
            ) : data && data.autopilot.active_rules > 0 ? (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                  {data.autopilot.running_rules ? <Loader2 size={17} className="animate-spin text-violet" /> : <Bot size={17} className="text-violet" />}
                </span>
                <div>
                  <p className="text-[14px] font-medium text-ink">{data.autopilot.active_rules} {data.autopilot.active_rules === 1 ? "búsqueda activa" : "búsquedas activas"}</p>
                  <p className="text-[12.5px] text-ink-dim">
                    {data.autopilot.running_rules
                      ? "Buscando clientes ahora mismo…"
                      : data.autopilot.next_run_at
                        ? `Próxima: ${new Date(data.autopilot.next_run_at).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "Programado"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Bot size={24} className="mx-auto text-violet" />
                <p className="mt-3 text-[14px] font-medium text-ink">Pon a Jarvis a trabajar solo</p>
                <p className="mt-1 text-[12.5px] text-ink-dim">Define rubros y ciudades una vez y recibe clientes nuevos cada día.</p>
                <Link href="/autopilot" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-white/[0.1]">
                  Activar <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
