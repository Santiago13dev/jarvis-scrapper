"use client";

import { useEffect, useState } from "react";
import { Check, Facebook, Globe, Instagram, Loader2, Mail, Megaphone, MessageCircle, PenLine, Phone, Star, Trash2, X } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { ScoreRing } from "@/components/ui/score-ring";
import { SERVICE_META } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/types/api";
import { externalUrl, LEAD_STATUSES } from "./lead-meta";

function Channel({ href, icon: Icon, label, iconClass, disabled }: { href?: string | null; icon: typeof Phone; label: string; iconClass: string; disabled?: boolean }) {
  const base = "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[12px] transition-colors";
  if (!href || disabled) {
    return <span className={cn(base, "border-border/50 text-ink-dim/40")}><Icon size={17} /> {label}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(base, "border-border text-ink-muted hover:border-border-light hover:bg-white/[0.03] hover:text-ink")}>
      <Icon size={17} className={iconClass} /> {label}
    </a>
  );
}

export function LeadDrawer({
  lead, onClose, onStatus, onDoNotContact, onDraft, onCampaign, onDelete,
}: {
  lead: Lead | null;
  onClose: () => void;
  onStatus: (status: LeadStatus) => Promise<void>;
  onDoNotContact: (value: boolean) => Promise<void>;
  onDraft: () => Promise<string>;
  onCampaign: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setNote(null);
    if (!lead) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lead, onClose]);

  if (!lead) return null;
  const service = lead.score_niche ? SERVICE_META[lead.score_niche] : undefined;
  const reasons = (lead.score_reasons ?? []).filter((reason) => reason.points > 0);
  const pitch = lead.lead_score_summary?.split(". ")[0];

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    try { await action(); } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={lead.name}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[480px] flex-col overflow-y-auto border-l border-border bg-card shadow-2xl [animation:rise-in_0.25s_ease-out]">
        <header className="flex items-start gap-4 px-7 pb-6 pt-7">
          <ScoreRing score={lead.lead_score} size={56} stroke={4} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[19px] font-semibold leading-snug tracking-tight text-ink">{lead.name}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-dim">
              <span className="flex items-center gap-1.5"><Flag code={lead.country} /> {lead.category ?? "Negocio"}</span>
              {lead.rating ? (
                <span className="flex items-center gap-1"><Star size={12} className="fill-amber text-amber" /> <span className="text-ink">{lead.rating.toFixed(1)}</span> · {lead.reviews_count ?? 0} reseñas</span>
              ) : null}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 rounded-lg p-1.5 text-ink-dim hover:bg-white/[0.05] hover:text-ink"><X size={18} /></button>
        </header>

        <div className="space-y-8 px-7 pb-8">
          {/* Qué venderle y por qué */}
          <section>
            <p className="text-[12px] font-medium text-ink-dim">Qué venderle</p>
            {service ? (
              <p className="mt-1.5 flex items-center gap-2 text-[16px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: service.color }} /> {pitch ?? service.label}
              </p>
            ) : (
              <p className="mt-1.5 text-[14px] text-ink-muted">Jarvis aún está analizando este negocio.</p>
            )}
            {reasons.length > 0 && (
              <ul className="mt-4 space-y-2.5">
                {reasons.map((reason) => (
                  <li key={reason.description} className="flex items-start justify-between gap-4 text-[13px]">
                    <span className="flex gap-2 text-ink-muted"><Check size={14} className="mt-0.5 shrink-0 text-accent" /> {reason.description}</span>
                    <span className="shrink-0 tabular-nums text-ink-dim">+{Math.round(reason.points)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Contacto */}
          <section>
            <p className="mb-3 text-[12px] font-medium text-ink-dim">Contactar</p>
            <div className="grid grid-cols-3 gap-2">
              <Channel href={lead.whatsapp ? `https://wa.me/${lead.whatsapp}` : null} icon={MessageCircle} label="WhatsApp" iconClass="text-wa" disabled={lead.do_not_contact} />
              <Channel href={lead.phone ? `tel:${lead.phone.replace(/\s/g, "")}` : null} icon={Phone} label="Llamar" iconClass="text-ink" disabled={lead.do_not_contact} />
              <Channel href={lead.email ? `mailto:${lead.email}` : null} icon={Mail} label="Email" iconClass="text-blue" disabled={lead.do_not_contact} />
              <Channel href={lead.website ? externalUrl(lead.website) : null} icon={Globe} label="Web" iconClass="text-cyan" />
              <Channel href={lead.instagram ? externalUrl(lead.instagram) : null} icon={Instagram} label="Instagram" iconClass="text-pink" />
              <Channel href={lead.facebook ? externalUrl(lead.facebook) : null} icon={Facebook} label="Facebook" iconClass="text-blue" />
            </div>
            <dl className="mt-5 space-y-3 text-[13px]">
              {lead.phone && <div className="flex justify-between gap-4"><dt className="text-ink-dim">Teléfono</dt><dd className="tabular-nums text-ink">{lead.phone}</dd></div>}
              {lead.email && <div className="flex justify-between gap-4"><dt className="text-ink-dim">Email</dt><dd className="truncate text-ink">{lead.email}</dd></div>}
              {lead.address && <div className="flex justify-between gap-4"><dt className="shrink-0 text-ink-dim">Dirección</dt><dd className="text-right text-ink-muted">{lead.address}</dd></div>}
              {lead.listing_url && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-dim">Ficha en directorio</dt>
                  <dd className="truncate"><a href={externalUrl(lead.listing_url)} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">Abrir</a></dd>
                </div>
              )}
              {lead.contact_attempts > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-dim">Contactado</dt>
                  <dd className="text-ink-muted">
                    {lead.contact_attempts} {lead.contact_attempts === 1 ? "vez" : "veces"}
                    {lead.last_contacted_at ? ` · ${new Date(lead.last_contacted_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Etapa */}
          <section>
            <p className="mb-3 text-[12px] font-medium text-ink-dim">Etapa</p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((item) => (
                <button key={item.value} onClick={() => run(`status-${item.value}`, () => onStatus(item.value))} disabled={!!busy}
                  className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                    lead.status === item.value ? "border-border-light bg-white/[0.08] text-ink" : "border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                  {busy === `status-${item.value}` ? <Loader2 size={12} className="animate-spin" /> : <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} />}
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 text-[13px]">
              <span>
                <span className="block text-ink">No volver a contactar</span>
                <span className="block text-[12px] text-ink-dim">Jarvis nunca le escribirá ni le hará seguimiento.</span>
              </span>
              <input type="checkbox" checked={lead.do_not_contact} onChange={(event) => run("dnc", () => onDoNotContact(event.target.checked))} className="h-4 w-4 shrink-0 accent-[#f87171]" />
            </label>
          </section>

          {note && <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-[13px] text-ink-muted">{note}</p>}
        </div>

        <footer className="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-card px-7 py-4">
          <button
            onClick={() => run("draft", async () => setNote(await onDraft()))}
            disabled={!!busy || !lead.whatsapp || lead.do_not_contact}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[13.5px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-white/[0.06] disabled:text-ink-dim"
            title={!lead.whatsapp ? "Este negocio no tiene un celular con WhatsApp" : undefined}
          >
            {busy === "draft" ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />} Que Jarvis le escriba
          </button>
          <button onClick={onCampaign} title="Agregar a campaña" className="rounded-lg border border-border px-3 text-ink-muted hover:border-border-light hover:text-ink"><Megaphone size={16} /></button>
          <button onClick={onDelete} title="Eliminar lead" className="rounded-lg border border-border px-3 text-ink-muted hover:border-red/40 hover:text-red"><Trash2 size={16} /></button>
        </footer>
      </aside>
    </div>
  );
}
