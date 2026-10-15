"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, MessageCircle, Search, Send } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Flag } from "@/components/ui/flag";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { normalize } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Conversation, Lead } from "@/types/api";

function shortTime(value: string) {
  const date = new Date(value);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export default function ConversationsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const result = await api.get<Conversation[]>(`/workspaces/${workspaceId}/whatsapp/conversations`);
      setConversations(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las conversaciones");
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    load();
    api.get<Lead[]>(`/workspaces/${workspaceId}/leads?limit=5000`)
      .then((list) => setLeads(Object.fromEntries(list.map((lead) => [lead.id, lead]))))
      .catch(() => undefined);
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [workspaceId, load]);

  const sorted = useMemo(() => {
    const q = normalize(query);
    return (conversations ?? [])
      .map((conversation) => ({ conversation, last: conversation.messages[conversation.messages.length - 1] }))
      .filter(({ conversation }) => !q || normalize(`${leads[conversation.lead_id]?.name ?? ""} ${conversation.phone}`).includes(q))
      .sort((a, b) => new Date(b.last?.sent_at ?? 0).getTime() - new Date(a.last?.sent_at ?? 0).getTime());
  }, [conversations, leads, query]);

  const selected = conversations?.find((conversation) => conversation.id === selectedId) ?? null;
  const selectedLead = selected ? leads[selected.lead_id] : undefined;

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [selectedId, selected?.messages.length]);

  async function send() {
    if (!workspaceId || !selected || !draft.trim()) return;
    setSending(true); setError(null);
    try {
      const updated = await api.post<Conversation>(`/workspaces/${workspaceId}/whatsapp/conversations/${selected.id}/messages`, { text: draft.trim() });
      setConversations((prev) => prev?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      {error && <div className="mb-4 rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-[13px] text-red">{error}</div>}

      <div className="grid h-[calc(100dvh-190px)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[340px_1fr]">
        {/* Contactos */}
        <aside className={cn("flex min-h-0 flex-col border-border lg:border-r", selected && "hidden lg:flex")}>
          <div className="border-b border-border p-4">
            <label className="flex items-center gap-2 rounded-lg bg-input px-3 py-2">
              <Search size={15} className="text-ink-dim" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversación" className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-dim" />
            </label>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {conversations === null && Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="flex gap-3 px-4 py-3.5"><div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.05]" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.05]" /><div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" /></div></li>
            ))}
            {conversations?.length === 0 && (
              <li className="px-6 py-14 text-center">
                <MessageCircle size={26} className="mx-auto text-ink-dim" />
                <p className="mt-3 text-[14px] font-medium text-ink">Aún no hay conversaciones</p>
                <p className="mt-1 text-[12.5px] text-ink-dim">Aparecen cuando Jarvis envía el primer mensaje a un cliente.</p>
                <Link href="/approvals" className="mt-4 inline-block text-[13px] font-medium text-ink underline underline-offset-4">Ir a aprobar mensajes</Link>
              </li>
            )}
            {sorted.map(({ conversation, last }) => {
              const lead = leads[conversation.lead_id];
              const unreadReply = last?.direction === "inbound";
              return (
                <li key={conversation.id}>
                  <button onClick={() => setSelectedId(conversation.id)}
                    className={cn("flex w-full gap-3 px-4 py-3.5 text-left transition-colors", selectedId === conversation.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[14px] font-semibold text-ink">
                      {(lead?.name ?? conversation.phone).charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-medium text-ink">{lead?.name ?? `+${conversation.phone}`}</span>
                        {last && <span className="shrink-0 text-[11px] text-ink-dim">{shortTime(last.sent_at)}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={cn("truncate text-[12.5px]", unreadReply ? "text-ink" : "text-ink-dim")}>
                          {last ? `${last.direction === "outbound" ? "Tú: " : ""}${last.text}` : "Sin mensajes"}
                        </span>
                        {unreadReply && <span className="neon-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Respondió" />}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Chat */}
        <section className={cn("min-h-0 flex-col", selected ? "flex" : "hidden lg:flex")}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                <button onClick={() => setSelectedId(null)} className="mr-1 text-[13px] text-ink-muted lg:hidden">←</button>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-[14px] font-semibold text-ink">
                  {(selectedLead?.name ?? selected.phone).charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-ink">{selectedLead?.name ?? `+${selected.phone}`}</p>
                  <p className="flex items-center gap-1.5 text-[12px] text-ink-dim">
                    <Flag code={selectedLead?.country} /> +{selected.phone}{selectedLead?.category ? ` · ${selectedLead.category}` : ""}
                  </p>
                </div>
                {selected.is_transferred_to_human && <span className="hidden rounded-md bg-amber/10 px-2 py-1 text-[11.5px] text-amber sm:block">Te toca responder</span>}
                <a href={`https://wa.me/${selected.phone}`} target="_blank" rel="noopener noreferrer" title="Abrir en WhatsApp"
                  className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-ink"><ExternalLink size={16} /></a>
              </header>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-6">
                {selected.messages.map((message) => (
                  <div key={message.id} className={cn("flex", message.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[78%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                      message.direction === "outbound" ? "rounded-br-md bg-accent/[0.14] text-ink" : "rounded-bl-md bg-white/[0.06] text-ink")}>
                      <p className="whitespace-pre-wrap">{message.text}</p>
                      <p className="mt-1 text-right text-[10.5px] text-ink-dim">
                        {message.sender === "ai_agent" ? "Jarvis · " : ""}{new Date(message.sent_at).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={(event) => { event.preventDefault(); send(); }} className="flex items-end gap-2 border-t border-border p-4">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={1} placeholder="Escribe una respuesta…"
                  onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }}
                  className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl bg-input px-4 py-3 text-[13.5px] text-ink outline-none placeholder:text-ink-dim" />
                <button type="submit" disabled={sending || !draft.trim()} aria-label="Enviar"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-ink disabled:opacity-40">
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageCircle size={28} className="mx-auto text-ink-dim" />
                <p className="mt-3 text-[14px] text-ink-muted">Selecciona una conversación</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
