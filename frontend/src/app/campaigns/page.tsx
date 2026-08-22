"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pause, Play, Square, Trash2, Users, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { Campaign } from "@/types/api";

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

  async function loadCampaigns(wsId: string) {
    try { const result = await api.get<Campaign[]>(`/workspaces/${wsId}/campaigns`); setCampaigns(result); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al cargar campañas"); }
  }

  useEffect(() => { if (workspaceId) loadCampaigns(workspaceId); }, [workspaceId]);

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
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Campañas</h1>
          <p className="text-[12px] text-ink-muted mt-0.5">Secuencias automatizadas de outreach por WhatsApp</p>
        </div>

        {error && <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-[13px] text-red">{error}</div>}

        {campaigns && campaigns.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total", value: campaigns.length, icon: Megaphone, color: "bg-accent/15 text-accent" },
              { label: "Activas", value: campaigns.filter((c) => c.status === "running").length, icon: Play, color: "bg-teal/15 text-teal" },
              { label: "Borradores", value: campaigns.filter((c) => c.status === "draft").length, icon: Clock, color: "bg-amber/15 text-amber" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border/40 bg-card p-4">
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
            <p className="text-[11px] text-ink-dim mt-1">Crea una desde la ficha de un lead</p>
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
              <div key={campaign.id} className="group rounded-xl border border-border/40 bg-card p-5 transition-all hover:border-accent/20 hover:bg-card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-accent/15 p-2.5"><Megaphone size={16} className="text-accent" /></div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <p className="font-medium text-ink text-[13px]">{campaign.name}</p>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[campaign.status] || ""}`}>{campaign.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-ink-muted"><Users size={10} />{campaign.lead_ids.length} leads</span>
                        <span className="text-ink-dim">·</span>
                        <span className="text-[11px] text-ink-dim">{new Date(campaign.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {actions.map((a) => { const Icon = a.icon; return (
                      <Button key={a.action} variant={a.variant} onClick={() => handleAction(campaign.id, a.action)} className="text-[12px]">
                        <Icon size={13} />{a.label}
                      </Button>
                    ); })}
                    <Button variant="ghost" className="text-red hover:text-red/80 hover:bg-red/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDeleteConfirmId(campaign.id)}>
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
    </AppShell>
  );
}
