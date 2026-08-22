"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Building2, Bot, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";

export default function SettingsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [workspaceName, setWorkspaceName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<any>(`/workspaces/${workspaceId}`).then((ws) => setWorkspaceName(ws.name ?? "")).catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<any>(`/workspaces/${workspaceId}/ai-config`).then((cfg) => setAiPrompt(cfg.knowledge_base ?? "")).catch(() => {});
  }, [workspaceId]);

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    try { await api.put(`/workspaces/${workspaceId}/ai-config`, { knowledge_base: aiPrompt }); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch {} finally { setSaving(false); }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Configuración</h1>
          <p className="text-[12px] text-ink-muted mt-0.5">Ajustes del workspace y del agente de IA</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Building2 size={16} className="text-accent" />
            <h2 className="font-medium text-ink text-[13px]">Workspace</h2>
          </div>
          <label className="block text-[11px] text-ink-muted uppercase tracking-wider mb-1.5">Nombre</label>
          <input type="text" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors" />
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bot size={16} className="text-accent" />
            <h2 className="font-medium text-ink text-[13px]">Agente IA</h2>
          </div>
          <label className="block text-[11px] text-ink-muted uppercase tracking-wider mb-1.5">Base de conocimiento</label>
          <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={6}
            className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink resize-none outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            placeholder="Ej: Somos una agencia de marketing digital especializada en restaurantes..." />
          <p className="mt-2 text-[11px] text-ink-dim">El agente usará esta información para responder a los leads.</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle size={16} className="text-accent" />
            <h2 className="font-medium text-ink text-[13px]">WhatsApp</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red" />
            <span className="text-[13px] text-ink-muted">No conectado</span>
          </div>
          <p className="mt-2 text-[11px] text-ink-dim">Configura WhatsApp en docker-compose.yml para habilitar el envío de mensajes.</p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="bg-accent hover:bg-accent-hover text-white">
          <Save size={14} />
          {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar cambios"}
        </Button>
      </div>
    </AppShell>
  );
}
