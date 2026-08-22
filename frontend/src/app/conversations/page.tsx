"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { Conversation } from "@/types/api";

export default function ConversationsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<Conversation[]>(`/workspaces/${workspaceId}/conversations`)
      .then(setConversations)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, [workspaceId]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Conversaciones</h1>
          <p className="text-[12px] text-ink-muted mt-0.5">Chat en tiempo real con leads vía WhatsApp</p>
        </div>

        {error && <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-[13px] text-red">{error}</div>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            <div className="border-b border-border/30 px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-dim">Contactos</p>
            </div>
            <div className="divide-y divide-border/20">
              {conversations === null && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4"><div className="h-4 w-3/4 animate-pulse rounded bg-border/20" /></div>
              ))}
              {conversations?.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-ink-muted">Sin conversaciones activas</p>}
              {conversations?.map((conv) => (
                <button key={conv.id} onClick={() => setSelected(conv.id)}
                  className={`w-full px-5 py-3 text-left transition-colors hover:bg-card-hover ${selected === conv.id ? "bg-card-hover" : ""}`}>
                  <p className="text-[13px] font-medium text-ink">{conv.phone}</p>
                  <p className="text-[11px] text-ink-muted truncate">{conv.messages?.[0]?.text ?? "Sin mensajes"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card flex flex-col min-h-[400px]">
            {selected ? (
              <>
                <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                  <p className="text-center text-[13px] text-ink-muted">Mensajes de la conversación</p>
                </div>
                <div className="border-t border-border/30 p-4">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Escribe un mensaje..." className="flex-1 rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim outline-none" disabled />
                    <button className="rounded-lg bg-teal/20 px-4 py-2.5 text-[12px] font-medium text-teal opacity-50" disabled>Enviar</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-ink-muted">
                <div className="text-center">
                  <MessageCircle className="mx-auto mb-3 text-ink-dim/30" size={36} />
                  <p className="text-[13px]">Selecciona una conversación</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
