"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil, Plus, Trash2, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { MessageTemplate } from "@/types/api";

export default function TemplatesPage() {
  const { workspaceId } = useActiveWorkspace();
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function loadTemplates(wsId: string) {
    try { const result = await api.get<MessageTemplate[]>(`/workspaces/${wsId}/templates/messages`); setTemplates(result); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al cargar plantillas"); }
  }

  useEffect(() => { if (workspaceId) loadTemplates(workspaceId); }, [workspaceId]);

  function openCreateModal() { setEditingTemplate(null); setName(""); setContent(""); setModalOpen(true); }
  function openEditModal(tpl: MessageTemplate) { setEditingTemplate(tpl); setName(tpl.name); setContent(tpl.content); setModalOpen(true); }

  async function handleSave() {
    if (!workspaceId || !name.trim() || !content.trim()) return;
    setSaving(true); setError(null);
    try {
      if (editingTemplate) {
        await api.patch(`/workspaces/${workspaceId}/templates/messages/${editingTemplate.id}`, { name: name.trim(), content: content.trim(), variables: [] });
      } else {
        await api.post(`/workspaces/${workspaceId}/templates/messages`, { name: name.trim(), content: content.trim(), variables: [] });
      }
      setModalOpen(false); setName(""); setContent(""); setEditingTemplate(null);
      await loadTemplates(workspaceId);
    } catch (err) { setError(err instanceof Error ? err.message : "Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(templateId: string) {
    if (!workspaceId) return; setDeleteConfirmId(null);
    try { await api.delete(`/workspaces/${workspaceId}/templates/messages/${templateId}`); await loadTemplates(workspaceId); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al eliminar"); }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">Mensajes reutilizables</h2>
            <p className="mt-1 text-[13.5px] text-ink-muted">Se usan en Campañas. Escribe <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12.5px] text-ink">{"{{lead_name}}"}</code> y Jarvis pondrá el nombre de cada negocio.</p>
          </div>
          <button onClick={openCreateModal} className="flex shrink-0 items-center gap-2 self-start rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink sm:self-auto"><Plus size={15} /> Nueva plantilla</button>
        </div>

        {error && <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-[13px] text-red">{error}</div>}

        {templates?.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
            <FileText className="mx-auto text-ink-dim" size={28} />
            <p className="mt-4 text-[15px] font-semibold text-ink">No hay plantillas todavía</p>
            <p className="mt-1 text-[13px] text-ink-dim">Crea una para usarla en tus campañas.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates === null && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
          {templates?.map((tpl) => (
            <div key={tpl.id} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-border-light">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-white/[0.05] p-2"><MessageSquare size={15} className="text-pink" /></div>
                  <h3 className="text-[14.5px] font-medium text-ink">{tpl.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tpl)} className="rounded-lg p-1.5 text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-ink" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteConfirmId(tpl.id)} className="rounded-lg p-1.5 text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-red" title="Eliminar"><Trash2 size={14} /></button>
                </div>
              </div>
              <p className="flex-1 whitespace-pre-line rounded-xl bg-white/[0.035] px-4 py-3 text-[13px] leading-relaxed text-ink-muted line-clamp-5">{tpl.content}</p>

            </div>
          ))}
        </div>
      </div>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>{editingTemplate ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
        <DialogDescription>{editingTemplate ? "Modifica el nombre o el contenido." : "Crea un mensaje para tus campañas."}</DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Nombre</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Saludo inicial"
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Mensaje</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder="Hola {{lead_name}}, vi tu negocio en Google Maps…"
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors resize-none" />
            <p className="mt-1.5 text-[12px] text-ink-dim">Usa {"{{lead_name}}"} para el nombre del negocio.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()} className="bg-accent hover:bg-accent-hover text-accent-ink">
            {saving ? "Guardando..." : editingTemplate ? "Guardar" : "Crear plantilla"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Eliminar plantilla</DialogTitle>
        <DialogDescription>¿Seguro que quieres eliminar esta plantilla?</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}><Trash2 size={14} /> Eliminar</Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
