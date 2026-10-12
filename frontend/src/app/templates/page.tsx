"use client";

import { useEffect, useState } from "react";
import { FileText, Pencil, Plus, Trash2, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { MessageTemplate } from "@/types/api";

// Deben coincidir con app/domain/services/outreach.py (render_message).
const VARIABLES = [
  { key: "negocio", label: "Nombre del negocio", sample: "Panadería La Espiga" },
  { key: "categoria", label: "Categoría", sample: "panadería" },
  { key: "ciudad", label: "Zona", sample: "Chapinero" },
  { key: "calificacion", label: "Calificación", sample: "4,7" },
  { key: "resenas", label: "Reseñas", sample: "312" },
  { key: "oportunidad", label: "Oportunidad detectada", sample: "todavía no tiene página web propia" },
];

function preview(text: string) {
  return VARIABLES.reduce((acc, v) => acc.split(`{{${v.key}}}`).join(v.sample), text.split("{{lead_name}}").join(VARIABLES[0].sample));
}

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-ink">Plantillas</h1>
            <p className="text-[12px] text-ink-muted mt-0.5">Mensajes con datos de cada negocio para «Contactar hoy» y campañas</p>
          </div>
          <Button onClick={openCreateModal} className="self-start bg-accent hover:bg-accent-hover text-white sm:self-auto"><Plus size={14} /> Nueva plantilla</Button>
        </div>

        {error && <div className="rounded-xl border border-red/30 bg-red/10 p-4 text-[13px] text-red">{error}</div>}

        {templates?.length === 0 && (
          <div className="rounded-xl border border-border/40 bg-card py-16 text-center">
            <FileText className="mx-auto mb-4 text-ink-dim/30" size={40} />
            <p className="text-[13px] text-ink-muted">No hay plantillas creadas todavía</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates === null && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-card border border-border/40 animate-pulse" />
          ))}
          {templates?.map((tpl) => (
            <div key={tpl.id} className="group rounded-xl border border-border/40 bg-card p-5 transition-all hover:border-accent/20 hover:bg-card-hover">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent/15 p-2"><MessageSquare size={14} className="text-accent" /></div>
                  <h3 className="font-medium text-ink text-[13px]">{tpl.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tpl)} className="rounded-lg p-1.5 text-ink-dim hover:text-accent hover:bg-accent/10 transition-colors" title="Editar"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteConfirmId(tpl.id)} className="rounded-lg p-1.5 text-ink-dim hover:text-red hover:bg-red/10 transition-colors" title="Eliminar"><Trash2 size={12} /></button>
                </div>
              </div>
              <p className="text-[12px] text-ink-muted line-clamp-3 leading-relaxed">{tpl.content}</p>
              <div className="mt-4 pt-3 border-t border-border/20">
                <span className="text-[9px] text-ink-dim uppercase tracking-wider">Plantilla de mensaje</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)}>
        <DialogTitle>{editingTemplate ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
        <DialogDescription>{editingTemplate ? "Modificá el nombre o contenido." : "Creá un mensaje para tus campañas."}</DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Nombre</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: Saludo inicial"
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Mensaje</label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={`Ej.: ${v.sample}`}
                  onClick={() => setContent((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}{{${v.key}}}`)}
                  className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/20"
                >
                  + {v.label}
                </button>
              ))}
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder="Hola, vi {{negocio}} en Google Maps y noté que {{oportunidad}}..."
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors resize-none" />
            {content.includes("{{") && (
              <div className="mt-3 rounded-lg border border-border/40 bg-void/40 p-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-dim">Así se verá</p>
                <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-muted">{preview(content)}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()} className="bg-accent hover:bg-accent-hover text-white">
            {saving ? "Guardando..." : editingTemplate ? "Guardar" : "Crear plantilla"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Eliminar plantilla</DialogTitle>
        <DialogDescription>¿Seguro que querés eliminar esta plantilla?</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}><Trash2 size={14} /> Eliminar</Button>
        </div>
      </Dialog>
    </AppShell>
  );
}
