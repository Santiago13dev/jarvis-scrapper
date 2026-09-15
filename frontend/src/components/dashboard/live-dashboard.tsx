"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle, Megaphone, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import type { Campaign, Conversation, DashboardSummary, Lead } from "@/types/api";

const METRICS = [
  { key: "total_leads", label: "Leads disponibles", icon: Users, tone: "text-blue bg-blue/10" },
  { key: "total_campaigns_active", label: "Campañas activas", icon: Megaphone, tone: "text-teal bg-teal/10" },
  { key: "total_conversations_open", label: "Conversaciones abiertas", icon: MessageCircle, tone: "text-accent bg-accent/10" },
  { key: "messages_sent_last_30_days", label: "Mensajes en 30 días", icon: CheckCircle2, tone: "text-pink bg-pink/10" },
] as const;

export function LiveDashboard() {
  const { workspaceId, loading: workspaceLoading } = useActiveWorkspace();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    Promise.all([
      api.get<DashboardSummary>(`/workspaces/${workspaceId}/dashboard/summary`),
      api.get<Lead[]>(`/workspaces/${workspaceId}/leads?limit=5`),
      api.get<Campaign[]>(`/workspaces/${workspaceId}/campaigns`),
      api.get<Conversation[]>(`/workspaces/${workspaceId}/whatsapp/conversations`),
    ])
      .then(([nextSummary, nextLeads, nextCampaigns, nextConversations]) => {
        setSummary(nextSummary);
        setLeads(nextLeads);
        setCampaigns(nextCampaigns);
        setConversations(nextConversations);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "No se pudo cargar el dashboard."));
  }, [workspaceId]);

  const loading = workspaceLoading || !summary;
  const recentCampaigns = campaigns.slice(0, 3);

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      <section className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue">Centro de operaciones</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Actividad de tu workspace</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Datos actualizados desde tus campañas, leads y conversaciones.</p>
        </div>
        <Link href="/leads" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue px-4 text-[13px] font-semibold text-white transition-colors hover:bg-blue/85">
          Buscar leads <ArrowRight size={15} />
        </Link>
      </section>

      {error && <p className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-[13px] text-red">{error}</p>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => {
          const Icon = metric.icon;
          const value = summary?.[metric.key] ?? 0;
          return (
            <div key={metric.key} className="rounded-lg border border-border/50 bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${metric.tone}`}><Icon size={18} /></span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-ink-dim">En vivo</span>
              </div>
              <p className="mt-5 text-3xl font-bold text-ink font-mono-data">{loading ? "--" : value.toLocaleString()}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{metric.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-border/50 bg-card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-4 sm:px-5">
            <div><h3 className="font-display text-sm font-bold text-ink">Leads recientes</h3><p className="mt-0.5 text-[11px] text-ink-muted">Registros reales de tu base comercial</p></div>
            <Link href="/leads" className="text-[12px] font-medium text-blue hover:text-blue/80">Ver todos</Link>
          </div>
          {leads.length > 0 ? <div className="divide-y divide-border/25">{leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
              <div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{lead.name || "Sin nombre"}</p><p className="mt-0.5 truncate text-[11px] text-ink-muted">{lead.category || lead.address || "Sin categoría"}</p></div>
              <span className="shrink-0 rounded-md border border-border/40 bg-input px-2 py-1 text-[10px] font-medium capitalize text-ink-muted">{lead.status}</span>
            </div>
          ))}</div> : <EmptyState href="/leads" action="Importar leads" text="Todavía no hay leads. Inicia una búsqueda para comenzar a construir tu base." />}
        </div>

        <div className="rounded-lg border border-border/50 bg-card lg:col-span-2">
          <div className="border-b border-border/30 px-4 py-4 sm:px-5"><h3 className="font-display text-sm font-bold text-ink">Estado comercial</h3><p className="mt-0.5 text-[11px] text-ink-muted">Señales de actividad actual</p></div>
          <div className="space-y-4 p-4 sm:p-5">
            <StatusLine label="Campañas activas" value={loading ? "--" : String(summary?.total_campaigns_active ?? 0)} tone="bg-teal" />
            <StatusLine label="Respuestas por atender" value={loading ? "--" : String(summary?.total_conversations_open ?? 0)} tone="bg-blue" />
            <StatusLine label="Tasa de conversión" value={loading ? "--" : `${(summary?.conversion_rate ?? 0).toFixed(1)}%`} tone="bg-accent" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/50 bg-card">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-4 sm:px-5"><h3 className="font-display text-sm font-bold text-ink">Campañas</h3><Link href="/campaigns" className="text-[12px] font-medium text-blue hover:text-blue/80">Gestionar</Link></div>
          {recentCampaigns.length > 0 ? <div className="divide-y divide-border/25">{recentCampaigns.map((campaign) => <div key={campaign.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><p className="truncate text-[13px] font-medium text-ink">{campaign.name}</p><span className="shrink-0 text-[11px] capitalize text-ink-muted">{campaign.status}</span></div>)}</div> : <EmptyState href="/leads" action="Crear campaña" text="No hay campañas creadas todavía." />}
        </div>
        <div className="rounded-lg border border-border/50 bg-card">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-4 sm:px-5"><h3 className="font-display text-sm font-bold text-ink">Conversaciones</h3><Link href="/conversations" className="text-[12px] font-medium text-blue hover:text-blue/80">Abrir bandeja</Link></div>
          {conversations.length > 0 ? <div className="divide-y divide-border/25">{conversations.slice(0, 3).map((conversation) => <div key={conversation.id} className="px-4 py-3 sm:px-5"><p className="text-[13px] font-medium text-ink">{conversation.phone}</p><p className="mt-0.5 truncate text-[11px] text-ink-muted">{conversation.messages.at(-1)?.text || "Sin mensajes"}</p></div>)}</div> : <EmptyState href="/whatsapp" action="Conectar WhatsApp" text="Aún no hay conversaciones registradas." />}
        </div>
      </section>
    </div>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[12px] text-ink-muted"><span className={`h-2 w-2 rounded-full ${tone}`} />{label}</span><span className="font-mono-data text-[13px] font-semibold text-ink">{value}</span></div>;
}

function EmptyState({ href, action, text }: { href: string; action: string; text: string }) {
  return <div className="px-5 py-8"><p className="max-w-sm text-[12px] leading-relaxed text-ink-muted">{text}</p><Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-blue hover:text-blue/80">{action} <ArrowRight size={13} /></Link></div>;
}