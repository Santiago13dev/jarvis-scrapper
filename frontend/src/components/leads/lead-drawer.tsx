"use client";

import { useEffect, useState } from "react";
import { Ban, ExternalLink, Facebook, Globe, Instagram, Mail, MapPin, Phone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { LEAD_STATUSES, contactByWhatsApp, ensureUrl, formatPhone, scoreTone } from "@/lib/leads";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/types/api";
import { PresenceBadge, Rating, ScoreBadge, StatusBadge, WhatsAppIcon } from "./lead-badges";

export function LeadDrawer({
  lead,
  workspaceId,
  onClose,
  onChanged,
  onNotify,
}: {
  lead: Lead | null;
  workspaceId: string;
  onClose: () => void;
  onChanged: () => void;
  onNotify: (message: string, tone?: "ok" | "error") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (!lead) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead) return null;
  const current = lead;
  const tone = scoreTone(current.lead_score);
  const reasons = [...(current.score_reasons ?? [])].sort((a, b) => b.points - a.points);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${current.name} ${current.address ?? ""}`)}`;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      onNotify(success);
      onChanged();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "No se pudo completar la acción.", "error");
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: LeadStatus, doNotContact?: boolean) =>
    run(
      () => api.patch(`/workspaces/${workspaceId}/leads/${current.id}/status`, { status, do_not_contact: doNotContact ?? current.do_not_contact }),
      doNotContact ? "Marcado como «no contactar»." : "Estado actualizado.",
    );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-void/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-y-auto border-l border-border/40 bg-card shadow-2xl sm:max-w-md"
        aria-label={`Ficha de ${current.name}`}
      >
        <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-border/30 bg-card/95 px-5 py-4 backdrop-blur">
          <ScoreBadge score={current.lead_score} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-bold leading-tight text-ink">{current.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{current.category ?? "Sin categoría"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={current.status} />
              <PresenceBadge lead={current} />
              {current.do_not_contact && <span className="rounded-full bg-red/15 px-2 py-0.5 text-[10px] font-semibold text-red">No contactar</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1.5 text-ink-dim hover:bg-white/5 hover:text-ink">
            <X size={16} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          {/* Acciones de contacto */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={busy || !current.whatsapp || current.do_not_contact}
              onClick={() =>
                run(() => contactByWhatsApp(workspaceId, current.id), "WhatsApp abierto. Te recordaremos hacer seguimiento en 3 días.")
              }
              className="col-span-2 bg-[#25D366] text-[#06210f] shadow-none hover:bg-[#2ee26f]"
            >
              <WhatsAppIcon size={16} /> {current.whatsapp ? "Escribir por WhatsApp" : "Sin WhatsApp"}
            </Button>
            {current.phone && (
              <a href={`tel:${current.phone.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-input px-3 py-2 text-[12px] text-ink hover:border-accent/40">
                <Phone size={13} /> Llamar
              </a>
            )}
            {current.email && (
              <a href={`mailto:${current.email}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border/50 bg-input px-3 py-2 text-[12px] text-ink hover:border-accent/40">
                <Mail size={13} /> Correo
              </a>
            )}
          </div>

          {/* Por qué es buen prospecto */}
          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-dim">
              {tone.label} {current.lead_score != null && `· ${current.lead_score}/100`}
            </h3>
            {reasons.length === 0 ? (
              <p className="text-[12px] text-ink-dim">Aún sin calcular. Usa «Actualizar datos» en Leads.</p>
            ) : (
              <ul className="space-y-1.5">
                {reasons.map((reason) => (
                  <li key={reason.description} className="flex items-start justify-between gap-3 text-[12px]">
                    <span className={reason.points > 0 ? "text-ink" : "text-ink-dim"}>{reason.description}</span>
                    <span className={cn("shrink-0 font-mono", reason.points > 0 ? "text-teal" : "text-ink-dim")}>
                      {reason.points > 0 ? `+${Math.round(reason.points)}` : "0"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Datos */}
          <section className="space-y-2.5 text-[12px]">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim">Datos del negocio</h3>
            <Rating rating={current.rating} reviews={current.reviews_count} />
            {current.whatsapp && (
              <p className="flex items-center gap-2 text-ink"><WhatsAppIcon size={13} className="text-[#25D366]" /> {formatPhone(current.whatsapp)}</p>
            )}
            {current.phone && <p className="flex items-center gap-2 text-ink"><Phone size={13} className="text-ink-dim" /> {current.phone}</p>}
            {current.email && <p className="flex items-center gap-2 break-all text-ink"><Mail size={13} className="shrink-0 text-ink-dim" /> {current.email}</p>}
            {current.address && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-ink-muted hover:text-ink">
                <MapPin size={13} className="mt-0.5 shrink-0 text-ink-dim" /> {current.address}
              </a>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {current.website && <LinkChip href={current.website} icon={<Globe size={12} />} label="Página web" />}
              {current.instagram && <LinkChip href={current.instagram} icon={<Instagram size={12} />} label="Instagram" />}
              {current.facebook && <LinkChip href={current.facebook} icon={<Facebook size={12} />} label="Facebook" />}
              {current.listing_url && <LinkChip href={current.listing_url} icon={<ExternalLink size={12} />} label="Ficha en directorio" />}
              <LinkChip href={mapsUrl} icon={<MapPin size={12} />} label="Google Maps" />
            </div>
          </section>

          {/* Seguimiento comercial */}
          <section className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-dim">Seguimiento</h3>
            <p className="text-[12px] text-ink-muted">
              {current.contact_attempts > 0
                ? `Contactado ${current.contact_attempts} ${current.contact_attempts === 1 ? "vez" : "veces"}, la última el ${new Date(current.last_contacted_at ?? "").toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.`
                : "Todavía no lo has contactado."}
            </p>
            <label className="block text-[11px] text-ink-dim">Estado</label>
            <select
              value={current.status}
              disabled={busy}
              onChange={(e) => void setStatus(e.target.value as LeadStatus)}
              className="w-full rounded-lg border border-border/50 bg-input px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/50"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={() => void setStatus(current.do_not_contact ? current.status : "lost", !current.do_not_contact)}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium",
                current.do_not_contact ? "border-border/50 text-ink-muted hover:text-ink" : "border-red/30 text-red hover:bg-red/10",
              )}
            >
              <Ban size={13} /> {current.do_not_contact ? "Permitir contactarlo de nuevo" : "No volver a contactar"}
            </button>
          </section>

          <section className="border-t border-border/30 pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[12px] text-ink-muted">¿Eliminar este lead definitivamente?</span>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>No</Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => run(() => api.delete(`/workspaces/${workspaceId}/leads/${current.id}`), "Lead eliminado.").then(onClose)}
                >
                  Sí, eliminar
                </Button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-[12px] text-ink-dim hover:text-red">
                <Trash2 size={13} /> Eliminar lead
              </button>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function LinkChip({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={ensureUrl(href)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-input px-2.5 py-1 text-[11px] text-ink-muted hover:border-accent/40 hover:text-ink"
    >
      {icon} {label}
    </a>
  );
}
