"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardLabel } from "@/components/ui/card";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { DashboardSummary } from "@/types/api";

const STAT_TILES: { key: keyof DashboardSummary; label: string; format?: (v: number) => string }[] = [
  { key: "total_leads", label: "Leads totales" },
  { key: "total_campaigns_active", label: "Campañas activas" },
  { key: "total_conversations_open", label: "Conversaciones abiertas" },
  {
    key: "average_lead_score",
    label: "Score promedio",
    format: (v) => v.toFixed(0),
  },
  {
    key: "conversion_rate",
    label: "Tasa de conversión",
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
  { key: "messages_sent_last_30_days", label: "Mensajes (30 días)" },
];

export default function DashboardPage() {
  const { workspaceId, loading: workspaceLoading } = useActiveWorkspace();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<DashboardSummary>(`/workspaces/${workspaceId}/dashboard/summary`)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar estadísticas"));
  }, [workspaceId]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-medium text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted">Vista general de la prospección de tu agencia.</p>
      </div>

      {workspaceLoading && (
        <p className="text-sm text-ink-muted">Cargando workspace…</p>
      )}

      {!workspaceLoading && !workspaceId && (
        <Card className="text-center">
          <p className="text-sm text-ink-muted">
            Todavía no hay ningún workspace creado para tu organización. Crea uno para
            empezar a importar leads.
          </p>
        </Card>
      )}

      {error && (
        <Card className="border-signal-red/30 bg-signal-red/5 text-signal-red">
          No se pudo conectar con la API: {error}
        </Card>
      )}

      {workspaceId && !summary && !error && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {STAT_TILES.map((tile) => (
            <Card key={tile.key} className="animate-pulse">
              <CardLabel>{tile.label}</CardLabel>
              <div className="mt-3 h-7 w-16 rounded bg-surface-raised" />
            </Card>
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {STAT_TILES.map((tile) => (
            <Card key={tile.key}>
              <CardLabel>{tile.label}</CardLabel>
              <p className="mt-2 font-mono-data text-2xl font-medium text-ink">
                {tile.format ? tile.format(summary[tile.key]) : summary[tile.key]}
              </p>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
