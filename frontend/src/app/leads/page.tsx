"use client";

import { useEffect, useState } from "react";
import { Globe, Phone, RefreshCw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreRing } from "@/components/ui/score-ring";
import { StatusBadge } from "@/components/ui/badge";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { Lead } from "@/types/api";

export default function LeadsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function loadLeads(wsId: string) {
    try {
      const result = await api.get<Lead[]>(`/workspaces/${wsId}/leads`);
      setLeads(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar leads");
    }
  }

  useEffect(() => {
    if (workspaceId) loadLeads(workspaceId);
  }, [workspaceId]);

  async function handleImport() {
    if (!workspaceId) return;
    setImporting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/leads/import`, {
        keyword: "restaurantes",
        location: "Bogotá, Colombia",
        max_results: 50,
      });
      await loadLeads(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al importar leads");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Leads</h1>
          <p className="text-sm text-ink-muted">
            Negocios detectados y su oportunidad comercial estimada.
          </p>
        </div>
        <Button onClick={handleImport} disabled={!workspaceId || importing}>
          <RefreshCw size={15} className={importing ? "animate-spin" : ""} />
          {importing ? "Importando…" : "Importar desde Google Maps"}
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-signal-red/30 bg-signal-red/5 text-signal-red">
          {error}
        </Card>
      )}

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3 font-medium">Señal</th>
              <th className="px-5 py-3 font-medium">Negocio</th>
              <th className="px-5 py-3 font-medium">Categoría</th>
              <th className="px-5 py-3 font-medium">Contacto</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {leads === null &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-hairline last:border-0">
                  <td className="px-5 py-4" colSpan={5}>
                    <div className="h-5 animate-pulse rounded bg-surface-raised" />
                  </td>
                </tr>
              ))}

            {leads?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-ink-muted">
                  <Sparkles className="mx-auto mb-2 text-ink-muted" size={20} />
                  Sin leads todavía. Importa negocios desde Google Maps para empezar.
                </td>
              </tr>
            )}

            {leads?.map((lead) => (
              <tr key={lead.id} className="border-b border-hairline last:border-0 hover:bg-surface-raised/50">
                <td className="px-5 py-3">
                  <ScoreRing score={lead.lead_score} size={36} />
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-ink">{lead.name}</p>
                  <p className="text-xs text-ink-muted">{lead.address ?? "Sin dirección"}</p>
                </td>
                <td className="px-5 py-3 text-ink-muted">{lead.category ?? "—"}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 text-ink-muted">
                    {lead.phone && (
                      <span className="flex items-center gap-1 font-mono-data text-xs">
                        <Phone size={13} /> {lead.phone}
                      </span>
                    )}
                    {lead.website && <Globe size={13} />}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={lead.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
