import { COUNTRY_META, SERVICE_META } from "@/lib/sections";
import { api } from "@/lib/api-client";
import type { Lead, LeadStatus, OutreachItem } from "@/types/api";

export const LEAD_STATUSES: { value: LeadStatus; label: string; tone: string }[] = [
  { value: "new", label: "Nuevo", tone: "bg-blue/15 text-blue" },
  { value: "contacted", label: "Contactado", tone: "bg-accent/15 text-accent" },
  { value: "replied", label: "Respondió", tone: "bg-teal/15 text-teal" },
  { value: "qualified", label: "Interesado", tone: "bg-amber/15 text-amber" },
  { value: "demo_sent", label: "Propuesta enviada", tone: "bg-pink/15 text-pink" },
  { value: "won", label: "Cliente", tone: "bg-teal/25 text-teal" },
  { value: "lost", label: "Descartado", tone: "bg-border/40 text-ink-dim" },
];

export function statusInfo(status: LeadStatus) {
  return LEAD_STATUSES.find((item) => item.value === status) ?? LEAD_STATUSES[0];
}

export type Presence = "own" | "free" | "social" | "listing" | "none";

/** Qué tan presente está el negocio en internet (desde el punto de vista de venta). */
export function presenceOf(lead: Pick<Lead, "website" | "instagram" | "facebook" | "listing_url" | "tags">): Presence {
  if (lead.website) return lead.tags?.includes("web-gratuita") ? "free" : "own";
  if (lead.instagram || lead.facebook) return "social";
  if (lead.listing_url) return "listing";
  return "none";
}

export const PRESENCE_LABEL: Record<Presence, { label: string; tone: string; hint: string }> = {
  none: { label: "Sin presencia web", tone: "bg-teal/15 text-teal", hint: "No tiene página ni redes: oportunidad completa" },
  listing: { label: "Solo directorio", tone: "bg-teal/15 text-teal", hint: "Solo aparece en directorios como Restaurant Guru" },
  social: { label: "Solo redes", tone: "bg-teal/15 text-teal", hint: "Tiene Instagram/Facebook pero no página propia" },
  free: { label: "Web gratuita", tone: "bg-amber/15 text-amber", hint: "Página en Wix, Blogspot o similar" },
  own: { label: "Web propia", tone: "bg-border/40 text-ink-muted", hint: "Tiene página propia (revisa la auditoría)" },
};

export function scoreTone(score: number | null | undefined) {
  if (score == null) return { ring: "border-border/50 text-ink-dim", bg: "bg-border/20", label: "Sin puntaje" };
  if (score >= 70) return { ring: "border-teal/60 text-teal", bg: "bg-teal/10", label: "Potencial alto" };
  if (score >= 40) return { ring: "border-amber/60 text-amber", bg: "bg-amber/10", label: "Potencial medio" };
  return { ring: "border-border/60 text-ink-muted", bg: "bg-border/10", label: "Potencial bajo" };
}

/** «573214915662» → «321 491 5662» (formato colombiano legible). */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("57") && digits.length === 12 ? digits.slice(2) : digits;
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return value;
}

export function cityOf(address: string | null): string {
  if (!address) return "";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? "";
}

export function ensureUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Abre WhatsApp con el mensaje listo y registra el contacto (agenda seguimiento en 3 días). */
export async function contactByWhatsApp(workspaceId: string, leadId: string, templateId?: string): Promise<OutreachItem> {
  const query = templateId ? `?template_id=${encodeURIComponent(templateId)}` : "";
  const item = await api.get<OutreachItem>(`/workspaces/${workspaceId}/leads/${leadId}/outreach${query}`);
  window.open(item.whatsapp_url, "_blank", "noopener,noreferrer");
  await api.post(`/workspaces/${workspaceId}/leads/${leadId}/contacted`, { channel: "whatsapp", follow_up_in_days: 3 });
  return item;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  // Evita fórmulas al abrir en Excel (=, +, -, @).
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Descarga un CSV que Excel abre con tildes correctas (BOM UTF-8 y separador «;»). */
export function downloadLeadsCsv(leads: Lead[], fileName = `leads-${new Date().toISOString().slice(0, 10)}.csv`) {
  const header = [
    "Negocio", "País", "Potencial", "Servicio recomendado", "Categoría", "WhatsApp", "Teléfono", "Correo", "Sitio web", "Instagram",
    "Facebook", "Calificación", "Reseñas", "Dirección", "Estado", "No contactar",
  ];
  const rows = leads.map((lead) => [
    lead.name, lead.country ? COUNTRY_META[lead.country]?.name ?? lead.country : "", lead.lead_score ?? "",
    lead.score_niche ? SERVICE_META[lead.score_niche]?.label ?? "" : "", lead.category ?? "", formatPhone(lead.whatsapp), lead.phone ?? "",
    lead.email ?? "", lead.website ?? "", lead.instagram ?? "", lead.facebook ?? "",
    lead.rating ?? "", lead.reviews_count ?? "", lead.address ?? "", statusInfo(lead.status).label,
    lead.do_not_contact ? "Sí" : "No",
  ]);
  const csv = "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
