"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, CheckCircle2, Download, Flame, Globe, Loader2, Megaphone, RefreshCw, Search, Send, Sparkles, Users, X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ImportPanel } from "@/components/leads/import-panel";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { PresenceBadge, Rating, ScoreBadge, StatusBadge, WhatsAppIcon } from "@/components/leads/lead-badges";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { LEAD_STATUSES, cityOf, contactByWhatsApp, downloadLeadsCsv, presenceOf } from "@/lib/leads";
import { cn } from "@/lib/utils";
import type { EnrichResult, ImportJob, Lead, LeadStatus, MessageTemplate } from "@/types/api";

type QuickFilter = "high" | "no_web" | "social" | "whatsapp" | "email" | "not_contacted";
type Sort = "score" | "reviews" | "rating" | "recent";

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "high", label: "Potencial alto" },
  { id: "no_web", label: "Sin página web" },
  { id: "social", label: "Solo redes" },
  { id: "whatsapp", label: "Con WhatsApp" },
  { id: "email", label: "Con correo" },
  { id: "not_contacted", label: "Sin contactar" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "score", label: "Mayor potencial" },
  { id: "reviews", label: "Más reseñas" },
  { id: "rating", label: "Mejor calificación" },
  { id: "recent", label: "Más recientes" },
];

const PER_PAGE = 25;

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export default function LeadsPage() {
  const { workspaceId, loading } = useActiveWorkspace();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<QuickFilter>>(new Set());
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [sort, setSort] = useState<Sort>("score");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice((current) => (current?.text === text ? null : current)), 6000);
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setLeads(await api.get<Lead[]>(`/workspaces/${workspaceId}/leads?limit=5000`));
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudieron cargar los leads.", "error");
    }
  }, [workspaceId, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const onImportFinished = useCallback(
    (job: ImportJob) => {
      if (job.status === "done") notify(`Listo: ${job.imported} negocios nuevos de «${job.keyword}».`);
      else notify(job.error ?? "La búsqueda falló.", "error");
      void load();
    },
    [load, notify],
  );

  async function enrichAll() {
    if (!workspaceId) return;
    setEnriching(true);
    try {
      const result = await api.post<EnrichResult>(`/workspaces/${workspaceId}/leads/enrich`);
      notify(
        `Datos actualizados: ${result.processed} leads, ${result.with_whatsapp} con WhatsApp, ${result.without_website} sin página web` +
          (result.audits_queued ? `. Revisando ${result.audits_queued} páginas web en segundo plano.` : "."),
      );
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudieron actualizar los datos.", "error");
    } finally {
      setEnriching(false);
    }
  }

  async function contact(lead: Lead) {
    if (!workspaceId) return;
    setContactingId(lead.id);
    try {
      await contactByWhatsApp(workspaceId, lead.id);
      notify(`WhatsApp abierto para ${lead.name}. Seguimiento agendado en 3 días.`);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "No se pudo abrir WhatsApp.", "error");
    } finally {
      setContactingId(null);
    }
  }

  const all = useMemo(() => leads ?? [], [leads]);

  const stats = useMemo(() => {
    const high = all.filter((lead) => (lead.lead_score ?? 0) >= 70).length;
    const noWeb = all.filter((lead) => !lead.website).length;
    const whatsapp = all.filter((lead) => lead.whatsapp).length;
    const contacted = all.filter((lead) => lead.contact_attempts > 0 || lead.status !== "new").length;
    return { total: all.length, high, noWeb, whatsapp, contacted };
  }, [all]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    let list = all.filter((lead) => {
      if (needle && !normalize(`${lead.name} ${lead.category ?? ""} ${lead.address ?? ""} ${lead.email ?? ""}`).includes(needle)) return false;
      if (status !== "all" && lead.status !== status) return false;
      if (filters.has("high") && (lead.lead_score ?? 0) < 70) return false;
      if (filters.has("no_web") && lead.website) return false;
      if (filters.has("social") && presenceOf(lead) !== "social") return false;
      if (filters.has("whatsapp") && !lead.whatsapp) return false;
      if (filters.has("email") && !lead.email) return false;
      if (filters.has("not_contacted") && (lead.contact_attempts > 0 || lead.status !== "new")) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "reviews") return (b.reviews_count ?? 0) - (a.reviews_count ?? 0);
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === "recent") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return (b.lead_score ?? -1) - (a.lead_score ?? -1) || (b.reviews_count ?? 0) - (a.reviews_count ?? 0);
    });
    return list;
  }, [all, query, status, filters, sort]);

  useEffect(() => setPage(1), [query, status, filters, sort]);

  const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const pageItems = visible.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const openLead = all.find((lead) => lead.id === openLeadId) ?? null;
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((lead) => selected.has(lead.id));

  function toggleFilter(id: QuickFilter) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = selected.size ? visible.filter((lead) => selected.has(lead.id)) : visible;
    downloadLeadsCsv(rows);
    notify(`Exportados ${rows.length} leads a CSV (se abre en Excel o Google Sheets).`);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Encabezado y acciones */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Leads</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">Negocios encontrados en Google Maps, ordenados por su potencial de venta.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button variant="secondary" onClick={() => void enrichAll()} disabled={!workspaceId || enriching} title="Completa WhatsApp/redes y recalcula el potencial">
              {enriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Actualizar datos
            </Button>
            <Link href="/outreach" className="hidden items-center gap-2 rounded-lg border border-[#25D366]/40 sm:inline-flex bg-[#25D366]/10 px-4 py-2 text-[13px] font-medium text-[#25D366] hover:bg-[#25D366]/20">
              <Send size={14} /> Contactar hoy
            </Link>
            <Button onClick={() => setImportOpen(true)} disabled={!workspaceId}>
              <Search size={14} /> Buscar negocios
            </Button>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[13px]",
              notice.tone === "ok" ? "border-teal/30 bg-teal/10 text-teal" : "border-red/30 bg-red/10 text-red",
            )}
          >
            <span className="flex items-center gap-2">{notice.tone === "ok" && <CheckCircle2 size={15} />} {notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        {workspaceId && (
          <ImportPanel workspaceId={workspaceId} open={importOpen} onOpenChange={setImportOpen} onFinished={onImportFinished} />
        )}

        {/* Indicadores */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat icon={<Users size={15} />} tone="bg-accent/15 text-accent" value={stats.total} label="Leads" />
          <Stat icon={<Flame size={15} />} tone="bg-teal/15 text-teal" value={stats.high} label="Potencial alto" onClick={() => toggleFilter("high")} active={filters.has("high")} />
          <Stat icon={<Globe size={15} />} tone="bg-amber/15 text-amber" value={stats.noWeb} label="Sin página web" onClick={() => toggleFilter("no_web")} active={filters.has("no_web")} />
          <Stat icon={<WhatsAppIcon size={15} />} tone="bg-[#25D366]/15 text-[#25D366]" value={stats.whatsapp} label="Con WhatsApp" onClick={() => toggleFilter("whatsapp")} active={filters.has("whatsapp")} />
          <Stat icon={<Send size={15} />} tone="bg-blue/15 text-blue" value={stats.contacted} label="Contactados" className="col-span-2 lg:col-span-1" />
        </div>

        {/* Búsqueda y filtros */}
        <div className="space-y-3 rounded-xl border border-border/40 bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/50 bg-input px-3 focus-within:border-accent/50">
              <Search size={14} className="text-ink-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, categoría, barrio o correo"
                className="w-full bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-ink-dim"
              />
              {query && <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={13} className="text-ink-dim" /></button>}
            </div>
            <div className="flex gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus | "all")}
                className="min-w-0 flex-1 rounded-lg border border-border/50 bg-input px-3 py-2 text-[13px] text-ink outline-none sm:flex-none"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos los estados</option>
                {LEAD_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/50 bg-input px-3 sm:flex-none">
                <ArrowUpDown size={13} className="shrink-0 text-ink-dim" />
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="min-w-0 bg-transparent py-2 text-[13px] text-ink outline-none" aria-label="Ordenar">
                  {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  filters.has(filter.id) ? "border-accent/50 bg-accent/15 text-accent" : "border-border/40 bg-input text-ink-muted hover:border-border hover:text-ink",
                )}
              >
                {filter.label}
              </button>
            ))}
            {(filters.size > 0 || status !== "all" || query) && (
              <button onClick={() => { setFilters(new Set()); setStatus("all"); setQuery(""); }} className="text-[12px] font-medium text-red hover:text-red/80">
                Quitar filtros
              </button>
            )}
            <span className="ml-auto text-[12px] text-ink-dim">{visible.length.toLocaleString("es-CO")} de {stats.total.toLocaleString("es-CO")}</span>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2">
              <span className="mr-auto text-[12px] font-medium text-accent">{selected.size} seleccionados</span>
              <Button variant="secondary" onClick={exportCsv}><Download size={13} /> Exportar</Button>
              <Button onClick={() => setCampaignOpen(true)}><Megaphone size={13} /> Crear campaña</Button>
              <button onClick={() => setSelected(new Set())} className="text-[12px] text-ink-dim hover:text-ink">Quitar selección</button>
            </div>
          )}
        </div>

        {/* Listado */}
        {leads === null || loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card py-16 text-[13px] text-ink-muted">
            <Loader2 size={16} className="animate-spin" /> Cargando leads…
          </div>
        ) : all.length === 0 ? (
          <EmptyState onSearch={() => setImportOpen(true)} />
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-card py-12 text-center text-[13px] text-ink-muted">Ningún lead coincide con los filtros.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/40 bg-card">
            {/* Computador: tabla */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/30 text-[11px] uppercase tracking-wider text-ink-dim">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar página"
                        checked={allOnPageSelected}
                        onChange={() => setSelected((prev) => {
                          const next = new Set(prev);
                          pageItems.forEach((lead) => (allOnPageSelected ? next.delete(lead.id) : next.add(lead.id)));
                          return next;
                        })}
                        className="accent-[#825aff]"
                      />
                    </th>
                    <th className="px-2 py-3 font-semibold">Potencial</th>
                    <th className="px-3 py-3 font-semibold">Negocio</th>
                    <th className="px-3 py-3 font-semibold">Presencia digital</th>
                    <th className="px-3 py-3 font-semibold">Reseñas</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((lead) => (
                    <tr key={lead.id} onClick={() => setOpenLeadId(lead.id)} className="cursor-pointer border-b border-border/20 transition-colors hover:bg-card-hover">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Seleccionar ${lead.name}`} checked={selected.has(lead.id)} onChange={() => toggleSelected(lead.id)} className="accent-[#825aff]" />
                      </td>
                      <td className="px-2 py-3"><ScoreBadge score={lead.lead_score} /></td>
                      <td className="max-w-[320px] px-3 py-3">
                        <p className="truncate font-semibold text-ink">{lead.name}</p>
                        <p className="truncate text-[12px] text-ink-dim">{[lead.category, cityOf(lead.address)].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-3 py-3"><PresenceBadge lead={lead} /></td>
                      <td className="px-3 py-3"><Rating rating={lead.rating} reviews={lead.reviews_count} /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={lead.status} />
                          {lead.do_not_contact && <span className="text-[10px] font-semibold text-red">No contactar</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <ContactButton lead={lead} busy={contactingId === lead.id} onContact={() => void contact(lead)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Celular: tarjetas */}
            <ul className="divide-y divide-border/20 md:hidden">
              {pageItems.map((lead) => (
                <li key={lead.id} onClick={() => setOpenLeadId(lead.id)} className="flex items-start gap-3 px-4 py-3 active:bg-card-hover">
                  <ScoreBadge score={lead.lead_score} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{lead.name}</p>
                    <p className="truncate text-[12px] text-ink-dim">{[lead.category, cityOf(lead.address)].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <PresenceBadge lead={lead} />
                      <StatusBadge status={lead.status} />
                      <Rating rating={lead.rating} reviews={lead.reviews_count} />
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ContactButton lead={lead} busy={contactingId === lead.id} onContact={() => void contact(lead)} compact />
                  </div>
                </li>
              ))}
            </ul>

            {/* Paginación */}
            <div className="flex flex-col items-center justify-between gap-2 border-t border-border/20 px-4 py-3 sm:flex-row">
              <span className="text-[12px] text-ink-dim">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, visible.length)} de {visible.length.toLocaleString("es-CO")}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <span className="text-[12px] text-ink-muted">Página {page} de {pages}</span>
                <Button variant="secondary" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
              </div>
              <Button variant="ghost" onClick={exportCsv}><Download size={13} /> Exportar {selected.size ? "selección" : "lista"}</Button>
            </div>
          </div>
        )}
      </div>

      {workspaceId && (
        <LeadDrawer
          lead={openLead}
          workspaceId={workspaceId}
          onClose={() => setOpenLeadId(null)}
          onChanged={() => void load()}
          onNotify={notify}
        />
      )}

      {workspaceId && (
        <CampaignDialog
          open={campaignOpen}
          onClose={() => setCampaignOpen(false)}
          workspaceId={workspaceId}
          leadIds={[...selected]}
          onCreated={(count) => {
            setSelected(new Set());
            notify(`Campaña creada con ${count} leads. Revísala en Campañas.`);
          }}
        />
      )}
    </AppShell>
  );
}

function Stat({
  icon, tone, value, label, onClick, active, className,
}: { icon: React.ReactNode; tone: string; value: number; label: string; onClick?: () => void; active?: boolean; className?: string }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors sm:block sm:p-4",
        active ? "border-accent/50" : "border-border/40",
        onClick && "hover:border-accent/30",
        className,
      )}
    >
      <span className={cn("inline-flex shrink-0 rounded-lg p-2", tone)}>{icon}</span>
      <span className="block min-w-0">
        <span className="block font-mono text-lg font-bold text-ink sm:mt-2 sm:text-xl">{value.toLocaleString("es-CO")}</span>
        <span className="block truncate text-[12px] text-ink-muted">{label}</span>
      </span>
    </Tag>
  );
}

function ContactButton({ lead, busy, onContact, compact }: { lead: Lead; busy: boolean; onContact: () => void; compact?: boolean }) {
  if (lead.do_not_contact) return <span className="text-[11px] text-ink-dim">—</span>;
  if (!lead.whatsapp) {
    return lead.phone ? (
      <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-[12px] text-ink-muted hover:text-ink">
        Llamar
      </a>
    ) : (
      <span className="text-[11px] text-ink-dim">Sin teléfono</span>
    );
  }
  return (
    <button
      onClick={onContact}
      disabled={busy}
      title="Abrir WhatsApp con el mensaje listo"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] font-semibold text-[#06210f] transition-colors hover:bg-[#2ee26f] disabled:opacity-50",
        compact ? "p-2.5" : "px-3 py-1.5 text-[12px]",
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <WhatsAppIcon size={14} />}
      {!compact && (lead.contact_attempts > 0 ? "Seguimiento" : "Escribir")}
    </button>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent"><Search size={20} /></div>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">Encuentra tus primeros clientes</h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-muted">
        Busca un tipo de negocio y una zona. Jarvis los trae de Google Maps, detecta cuáles no tienen página web y los ordena por potencial de venta.
      </p>
      <Button className="mt-5" onClick={onSearch}><Search size={14} /> Buscar negocios</Button>
    </div>
  );
}

function CampaignDialog({
  open, onClose, workspaceId, leadIds, onCreated,
}: { open: boolean; onClose: () => void; workspaceId: string; leadIds: string[]; onCreated: (count: number) => void }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api.get<MessageTemplate[]>(`/workspaces/${workspaceId}/templates/messages`).then(setTemplates).catch(() => setTemplates([]));
  }, [open, workspaceId]);

  async function create() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/workspaces/${workspaceId}/campaigns`, {
        name: name.trim() || `Campaña ${new Date().toLocaleDateString("es-CO")}`,
        message_template_id: templateId,
        lead_ids: leadIds,
      });
      onCreated(leadIds.length);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campaña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Crear campaña</DialogTitle>
      <DialogDescription>Agrupa {leadIds.length} leads con una plantilla de mensaje.</DialogDescription>
      <div className="mt-5 space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Campaña ${new Date().toLocaleDateString("es-CO")}`}
          className="w-full rounded-lg border border-border/50 bg-input px-3 py-2.5 text-[13px] text-ink outline-none focus:border-accent/50"
        />
        {templates.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Primero crea una plantilla en <Link href="/templates" className="text-accent hover:underline">Plantillas</Link>.</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => setTemplateId(template.id)}
                className={cn("w-full rounded-lg border p-3 text-left", templateId === template.id ? "border-accent/50 bg-accent/10" : "border-border/40 bg-input hover:border-border")}
              >
                <p className="text-[13px] font-medium text-ink">{template.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-dim">{template.content}</p>
              </button>
            ))}
          </div>
        )}
        {error && <p className="rounded-lg bg-red/10 px-3 py-2 text-[12px] text-red">{error}</p>}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void create()} disabled={saving || !templateId}>
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Megaphone size={14} />} Crear campaña
        </Button>
      </div>
    </Dialog>
  );
}
