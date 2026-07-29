"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardLabel } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { Campaign } from "@/types/api";

const ACTION_BY_NEXT_STATUS: Record<string, { action: string; icon: typeof Play; label: string }> = {
  running: { action: "resume", icon: Play, label: "Reanudar" },
  paused: { action: "pause", icon: Pause, label: "Pausar" },
  finished: { action: "finish", icon: Square, label: "Finalizar" },
};

export default function CampaignsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCampaigns(wsId: string) {
    try {
      const result = await api.get<Campaign[]>(`/workspaces/${wsId}/campaigns`);
      setCampaigns(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar campañas");
    }
  }

  useEffect(() => {
    if (workspaceId) loadCampaigns(workspaceId);
  }, [workspaceId]);

  async function handleAction(campaignId: string, action: string) {
    if (!workspaceId) return;
    try {
      await api.patch(`/workspaces/${workspaceId}/campaigns/${campaignId}/status`, { action });
      await loadCampaigns(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-medium text-ink">Campañas</h1>
        <p className="text-sm text-ink-muted">Secuencias de contacto por WhatsApp.</p>
      </div>

      {error && (
        <Card className="mb-4 border-signal-red/30 bg-signal-red/5 text-signal-red">
          {error}
        </Card>
      )}

      {campaigns?.length === 0 && (
        <Card className="py-12 text-center text-ink-muted">
          Sin campañas todavía. Crea una desde la ficha de un lead o grupo de leads.
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {campaigns === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse" />
          ))}

        {campaigns?.map((campaign) => {
          const nextAction =
            campaign.status === "running"
              ? ACTION_BY_NEXT_STATUS.paused
              : campaign.status === "paused"
                ? ACTION_BY_NEXT_STATUS.running
                : null;

          return (
            <Card key={campaign.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <p className="font-medium text-ink">{campaign.name}</p>
                  <StatusBadge status={campaign.status} />
                </div>
                <CardLabel className="mt-1 normal-case tracking-normal">
                  {campaign.lead_ids.length} leads en la secuencia
                </CardLabel>
              </div>

              <div className="flex items-center gap-2">
                {nextAction && (
                  <Button
                    variant="secondary"
                    onClick={() => handleAction(campaign.id, nextAction.action)}
                  >
                    <nextAction.icon size={14} />
                    {nextAction.label}
                  </Button>
                )}
                {campaign.status !== "finished" && (
                  <Button variant="ghost" onClick={() => handleAction(campaign.id, "finish")}>
                    <Square size={14} />
                    Finalizar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
