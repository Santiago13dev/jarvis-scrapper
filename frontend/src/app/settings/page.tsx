"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bot, Building2, CheckCircle2, MessageCircle, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { WorkspaceSettings } from "@/types/api";

const PROVIDERS: Record<string, { label: string; detail: string; tone: string }> = {
  assisted: {
    label: "Modo asistido",
    detail: "Cada mensaje se abre en tu WhatsApp para que lo envíes tú desde «Contactar hoy». Sin riesgo de bloqueo y sin costo.",
    tone: "bg-teal",
  },
  cloud_api: {
    label: "WhatsApp Cloud API (Meta)",
    detail: "Envío automático con plantillas aprobadas por Meta. Las respuestas llegan a Conversaciones.",
    tone: "bg-blue",
  },
  openwa: {
    label: "OpenWA (no oficial)",
    detail: "Envío automático desde una sesión de WhatsApp Web. Úsalo con volúmenes bajos: Meta puede bloquear el número.",
    tone: "bg-amber",
  },
};

const KB_PLACEHOLDER = [
  "Ej.:",
  "Somos Agencia Ejemplo, hacemos páginas web para negocios locales en Bogotá.",
  "Planes: Básico $600.000 (1 página + WhatsApp), Pro $1.200.000 (5 páginas + Google Maps + SEO).",
  "Entrega en 7 días hábiles. Atendemos de lunes a viernes de 8 a 6.",
  "Si preguntan algo que no está aquí, ofrece una llamada con un asesor.",
].join("\n");

export default function SettingsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [data, setData] = useState<WorkspaceSettings | null>(null);
  const [form, setForm] = useState({ name: "", business_category: "", knowledge_base: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<WorkspaceSettings>(`/workspaces/${workspaceId}/settings`)
      .then((result) => {
        setData(result);
        setForm({ name: result.name, business_category: result.business_category ?? "", knowledge_base: result.knowledge_base });
      })
      .catch((err) => setMessage({ text: err instanceof Error ? err.message : "No se pudo cargar la configuración.", ok: false }));
  }, [workspaceId]);

  const dirty =
    !!data && (form.name !== data.name || form.business_category !== (data.business_category ?? "") || form.knowledge_base !== data.knowledge_base);

  async function handleSave() {
    if (!workspaceId) return;
    if (form.name.trim().length < 2) {
      setMessage({ text: "El nombre debe tener al menos 2 caracteres.", ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.patch<WorkspaceSettings>(`/workspaces/${workspaceId}/settings`, form);
      setData(result);
      setForm({ name: result.name, business_category: result.business_category ?? "", knowledge_base: result.knowledge_base });
      setMessage({ text: "Cambios guardados.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "No se pudo guardar.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  const provider = PROVIDERS[data?.whatsapp_provider ?? "assisted"] ?? PROVIDERS.assisted;
  const inputClass =
    "w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Configuración</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">Datos de tu negocio y de cómo Jarvis contacta y responde a los prospectos.</p>
        </div>

        <section className="rounded-xl border border-border/40 bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Building2 size={16} className="text-accent" /> Tu negocio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-ink-muted">Nombre del espacio</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!data} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-ink-muted">¿Qué vendes?</span>
              <input
                value={form.business_category}
                onChange={(e) => setForm({ ...form, business_category: e.target.value })}
                disabled={!data}
                placeholder="Ej.: Páginas web, marketing digital…"
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border/40 bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Bot size={16} className="text-accent" /> Agente de IA
          </h2>
          <p className="mb-4 text-[12px] text-ink-muted">
            Cuando un prospecto responde por WhatsApp automático, el agente contesta usando <strong className="text-ink">solo</strong> esta
            información. Si no sabe la respuesta, pasa la conversación a una persona.
          </p>
          <textarea
            value={form.knowledge_base}
            onChange={(e) => setForm({ ...form, knowledge_base: e.target.value })}
            disabled={!data}
            rows={8}
            placeholder={KB_PLACEHOLDER}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
          <p className="mt-2 text-[11px] text-ink-dim">
            {data && !data.ai_enabled
              ? "La IA aún no está activa en el servidor (falta OPENAI_API_KEY en el .env). Puedes dejar esto listo desde ya."
              : "Incluye precios, servicios, tiempos de entrega, horario y preguntas frecuentes."}
          </p>
        </section>

        <section className="rounded-xl border border-border/40 bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ink">
            <MessageCircle size={16} className="text-accent" /> Envío por WhatsApp
          </h2>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", provider.tone)} />
            <span className="text-[13px] font-medium text-ink">{provider.label}</span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-muted">{provider.detail}</p>
          <p className="mt-2 text-[11px] text-ink-dim">
            El modo se cambia en el servidor con la variable WHATSAPP_PROVIDER (ver README). Estado de la conexión en{" "}
            <Link href="/whatsapp" className="text-accent hover:underline">WhatsApp</Link>.
          </p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
            <Save size={14} />
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
          {message && (
            <span className={cn("flex items-center gap-1.5 text-[12px]", message.ok ? "text-teal" : "text-red")}>
              {message.ok && <CheckCircle2 size={14} />} {message.text}
            </span>
          )}
        </div>
      </div>
    </AppShell>
  );
}
