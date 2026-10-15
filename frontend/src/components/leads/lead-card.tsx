"use client";

import { Check, Globe, Instagram, Mail, MessageCircle, Star } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { ScoreRing } from "@/components/ui/score-ring";
import { SERVICE_META } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types/api";
import { statusMeta } from "./lead-meta";

export function LeadCard({ lead, selected, onSelect, onOpen }: { lead: Lead; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  const service = lead.score_niche ? SERVICE_META[lead.score_niche] : undefined;
  const status = statusMeta(lead.status);
  const channels = [
    lead.whatsapp && { icon: MessageCircle, label: "WhatsApp", className: "text-wa" },
    lead.email && { icon: Mail, label: "Email", className: "text-ink-muted" },
    lead.website && { icon: Globe, label: "Sitio web", className: "text-ink-muted" },
    lead.instagram && { icon: Instagram, label: "Instagram", className: "text-ink-muted" },
  ].filter(Boolean) as { icon: typeof Mail; label: string; className: string }[];

  return (
    <article
      onClick={onOpen}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-2xl border bg-card p-5 transition-colors",
        selected ? "border-accent/60 bg-card-hover" : "border-border hover:border-border-light hover:bg-card-hover",
        lead.do_not_contact && "opacity-50",
      )}
    >
      <button
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        aria-label={selected ? "Quitar de la selección" : "Seleccionar"}
        className={cn("absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-md border transition-all",
          selected ? "border-accent bg-accent text-accent-ink" : "border-border-light opacity-0 group-hover:opacity-100")}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="flex items-start gap-3.5 pr-6">
        <ScoreRing score={lead.lead_score} size={44} stroke={3} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[14.5px] font-medium leading-snug text-ink">{lead.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[12.5px] text-ink-dim">
            <Flag code={lead.country} /> {lead.category ?? "Negocio"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[12.5px]">
        {service ? (
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: service.color }} /> {service.label}
          </span>
        ) : (
          <span className="text-ink-dim">Analizando…</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
        <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} /> {status.label}
        </span>
        <span className="flex items-center gap-2.5">
          {channels.map(({ icon: Icon, label, className }) => <Icon key={label} size={14} className={className} aria-label={label} />)}
          {lead.rating ? (
            <span className="ml-1 flex items-center gap-1 text-[12px] text-ink-muted">
              <Star size={12} className="fill-amber text-amber" />
              <span className="tabular-nums text-ink">{lead.rating.toFixed(1)}</span>
              <span className="tabular-nums text-ink-dim">({lead.reviews_count ?? 0})</span>
            </span>
          ) : null}
        </span>
      </div>
    </article>
  );
}
