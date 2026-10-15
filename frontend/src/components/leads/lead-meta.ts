import type { LeadStatus } from "@/types/api";

/** Etapas del embudo: un punto de color identifica cada una; el texto siempre va en tinta neutra. */
export const LEAD_STATUSES: { value: LeadStatus; label: string; dot: string }[] = [
  { value: "new", label: "Nuevo", dot: "bg-cyan" },
  { value: "contacted", label: "Contactado", dot: "bg-violet" },
  { value: "replied", label: "Respondió", dot: "bg-blue" },
  { value: "qualified", label: "Calificado", dot: "bg-amber" },
  { value: "demo_sent", label: "Demo enviada", dot: "bg-orange" },
  { value: "won", label: "Ganado", dot: "bg-accent" },
  { value: "lost", label: "Perdido", dot: "bg-red" },
];

export function statusMeta(status: string) {
  return LEAD_STATUSES.find((item) => item.value === status) ?? LEAD_STATUSES[0];
}

export function externalUrl(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}
