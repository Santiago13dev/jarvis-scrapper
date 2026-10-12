"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pause, Play, Square, Trash2, Users, Clock, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import Link from "next/link";
import type { Campaign, Lead, MessageTemplate, WorkspaceSettings } from "@/types/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-ink-dim/15 text-ink-muted border-ink-dim/20",
  running: "bg-teal/15 text-teal border-teal/25",
  paused: "bg-amber/15 text-amber border-amber/25",
  finished: "bg-accent/15 text-accent border-accent/25",
};

export default function CampaignsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<WorkspaceSettings["whatsapp_provider"] | null>(null);

  async function loadCampaigns(wsId: string) {
    try { const result = await api.get<Campaign[]>(`/workspaces/${wsId}/campaigns`); setCampaigns(result); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al cargar campañas"); }
  }

  useEffect(() => { if (workspaceId) loadCampaigns(workspaceId); }, [workspaceId]);
  useEffect(() => {
    if (!workspaceId) return;
    api.get<WorkspaceSettings>(`/workspaces/${workspaceId}/settings`).then((s) => setProvider(s.whatsapp_provider)).catch(() => setProvider(null));
  }, [workspaceId]);

  async function openCreateDialog() {
    if (!workspaceId) return;
    setError(null);
    try {
      const [availableLeads, availableTemplates] = await Promise.all([
        api.get<Lead[]>(`/workspaces/${workspaceId}/leads?limit=5000`),
        api.get<MessageTemplate[]>(`/workspaces/${workspaceId}/templates/messages`),
      ]);
      // Solo negocios a los que se les puede escribir y que no pidieron salir.
      setLeads(availableLeads.filter((lead) => lead.whatsapp && !lead.do_not_contact).sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)));
      setTemplates(availableTemplates);
      setSelectedLeadIds(new Set());
      setSelectedTemplateId(availableTemplates[0]?.id ?? "");
      setNoWebsiteOnly(false);
      setCampaignName("");
      setCreateOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los datos");
    }
  }

  async function handleCreateCampaign() {
    if (!workspaceId || !selectedTemplateId || selectedLeadIds.size === 0) return;
    setCreating(true);
    try {
      await api.post(`/workspaces/${workspaceId}/campaigns`, {
        name: campaignName.trim() || `Campaña - ${new Date().toLocaleDateString("es-CO")}`,
        message_template_id: selectedTemplateId,
        lead_ids: Array.from(selectedLeadIds),
      });
      setCreateOpen(false);
      await loadCampaigns(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campaña");
    } finally {
      setCreating(false);
    }
  }

  const selectableLeads = noWebsiteOnly
    ? leads.filter((lead) => !lead.website)
    : leads;

  async function handleAction(campaignId: string, action: string) {
    if (!workspaceId) return;
    try { await api.patch(`/workspaces/${workspaceId}/campaigns/${campaignId}/status`, { action }); await loadCampaigns(workspaceId); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar el estado"); }
  }

  async function handleDelete(campaignId: string) {
    if (!workspaceId) return; setDeleteConfirmId(null);
    try { await api.delete(`/workspaces/${workspaceId}/campaigns/${campaignId}`); await loadCampaigns(workspaceId); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo eliminar"); }
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Campañas</h1>
            <p className="text-[12px] text-ink-muted mt-0.5">Grupos de prospectos que reciben el mismo mensaje por WhatsApp</p>
          </div>
          <Button onClick={openCreateDialog} className="shrink-0 bg-accent hover:bg-accent-hover text-white text-[12px]">
            <Megaphone size={14} /> Nueva campaña
          </Button>
        </div>

        {provider === "assisted" && (
          <div className="rounded-xl border border-blue/25 bg-blue/5 px-4 py-3 text-[12px] text-ink-muted">
            Estás en <strong className="text-ink">modo asistido</strong>: las campañas sirven para agrupar prospectos, pero los mensajes se envían
            uno por uno desde <Link href="/outreach" className="font-medium text-accent hover:underline">Contactar hoy</Link>. Para envío automático
            activa la API oficial de WhatsApp (ver README).
          </div>
        )}

        {error && <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-[13px] text-red">{error}</div>}

        {campaigns && campaigns.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { label: "Total", value: campaigns.length, icon: Megaphone, color: "bg-accent/15 text-accent" },
              { label: "Activas", value: campaigns.filter((c) => c.status === "running").length, icon: Play, color: "bg-teal/15 text-teal" },
              { label: "Borradores", value: campaigns.filter((c) => c.status === "draft").length, icon: Clock, color: "bg-amber/15 text-amber" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border/40 bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${s.color}`}><s.icon size={16} /></div>
                  <div>
                    <p className="text-xl font-bold text-ink font-mono-data">{s.value}</p>
                    <p className="text-[10px] text-ink-dim uppercase tracking-wider">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {campaigns?.length === 0 && (
          <div className="rounded-xl border border-border/40 bg-card py-16 text-center">
            <Megaphone className="mx-auto mb-4 text-ink-dim/30" size={40} />
            <p className="text-[13px] text-ink-muted">Sin campañas todavía</p>
            <p className="text-[11px] text-ink-dim mt-1">Crea una con «Nueva campaña» o seleccionando negocios en Leads</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {campaigns === null && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card border border-border/40 animate-pulse" />
          ))}
          {campaigns?.map((campaign) => {
            const actions: { action: string; icon: typeof Play; label: string; variant?: "primary" | "secondary" | "danger" }[] = [];
            if (campaign.status === "draft") actions.push({ action: "resume", icon: Play, label: "Activar", variant: "primary" });
            else if (campaign.status === "running") { actions.push({ action: "pause", icon: Pause, label: "Pausar", variant: "secondary" }); actions.push({ action: "finish", icon: Square, label: "Finalizar", variant: "secondary" }); }
            else if (campaign.status === "paused") { actions.push({ action: "resume", icon: Play, label: "Reanudar", variant: "primary" }); actions.push({ action: "finish", icon: Square, label: "Finalizar", variant: "secondary" }); }

            return (
              <div key={campaign.id} className="group rounded-lg border border-border/40 bg-card p-4 transition-all hover:border-accent/20 hover:bg-card-hover sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    <div className="rounded-lg bg-accent/15 p-2.5"><Megaphone size={16} className="text-accent" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="truncate font-medium text-ink text-[13px]">{campaign.name}</p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[campaign.status] || ""}`}>{campaign.status}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] text-ink-muted"><Users size={10} />{campaign.lead_ids.length} leads</span>
                        <span className="text-ink-dim">·</span>
                        <span className="text-[11px] text-ink-dim">{new Date(campaign.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {actions.map((a) => { const Icon = a.icon; return (
                      <Button key={a.action} variant={a.variant} onClick={() => handleAction(campaign.id, a.action)} className="text-[12px]">
                        <Icon size={13} />{a.label}
                      </Button>
                    ); })}
                    <Button variant="ghost" className="text-red hover:text-red/80 hover:bg-red/10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => setDeleteConfirmId(campaign.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Eliminar campaña</DialogTitle>
        <DialogDescription>¿Seguro que querés eliminar esta campaña?</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}><Trash2 size={14} /> Eliminar</Button>
        </div>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
        <DialogTitle>Nueva campaña</DialogTitle>
        <DialogDescription>Selecciona una plantilla y los leads que recibirán la campaña.</DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Nombre</label>
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder={`Campaña - ${new Date().toLocaleDateString("es-CO")}`}
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Plantilla</label>
            {templates.length > 0 ? (
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="w-full rounded-lg border border-border/50 bg-input px-3 py-2.5 text-[13px] text-ink outline-none">
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            ) : <p className="text-[12px] text-ink-dim">Primero crea una plantilla en Plantillas.</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Leads</label>
            <button
              type="button"
              onClick={() => setNoWebsiteOnly((current) => !current)}
              className={`mb-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${noWebsiteOnly ? "border-accent/40 bg-accent/10 text-accent" : "border-border/40 bg-input text-ink-muted hover:border-border hover:text-ink"}`}
            >
              Sin sitio web
            </button>
            {selectableLeads.length > 0 ? (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/40 p-3">
                {selectableLeads.map((lead) => (
                  <label key={lead.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                    <input type="checkbox" checked={selectedLeadIds.has(lead.id)} onChange={() => setSelectedLeadIds((current) => {
                      const next = new Set(current);
                      next.has(lead.id) ? next.delete(lead.id) : next.add(lead.id);
                      return next;
                    })} />
                    <span>{lead.name}</span>
                  </label>
                ))}
              </div>
            ) : <p className="text-[12px] text-ink-dim">{noWebsiteOnly ? "No hay leads sin sitio web." : "Primero importa leads desde Google Maps."}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateCampaign} disabled={creating || !selectedTemplateId || selectedLeadIds.size === 0} className="bg-accent hover:bg-accent-hover text-white">
            {creating ? <RefreshCw size={14} className="animate-spin" /> : <Megaphone size={14} />}
            {creating ? "Creando..." : "Crear campaña"}
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
