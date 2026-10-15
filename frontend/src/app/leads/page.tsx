"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, CalendarClock, Check, ChevronDown, Download, LayoutGrid, List, Loader2, Megaphone, PenLine, RefreshCw, Search, Sparkles, X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import { statusMeta } from "@/components/leads/lead-meta";
import { JarvisSearch } from "@/components/search/jarvis-search";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Flag } from "@/components/ui/flag";
import { ScoreRing } from "@/components/ui/score-ring";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { normalize } from "@/lib/search";
import { COUNTRY_META, SERVICE_META } from "@/lib/sections";
import { cn } from "@/lib/utils";
import type { FollowUp, Lead, LeadStatus, MessageTemplate, OutreachActionResult } from "@/types/api";

const PAGE_SIZE = 24;
const VIEW_KEY = "jarvisia_leads_view";

const QUICK_FILTERS: { key: string; label: string; test: (lead: Lead) => boolean }[] = [
  { key: "alta", label: "Oportunidad alta", test: (l) => l.score_level === "high" },
  { key: "whatsapp", label: "Con WhatsApp", test: (l) => !!l.whatsapp },
  { key: "sinweb", label: "Sin página web", test: (l) => !l.website },
  { key: "email", label: "Con email", test: (l) => !!l.email },
  { key: "nuevos", label: "Sin contactar", test: (l) => l.status === "new" && !l.do_not_contact },
];

const SORTS = [
  { key: "score", label: "Mejor oportunidad" },
  { key: "reviews", label: "Más reseñas" },
  { key: "recent", label: "Más recientes" },
];

type Notice = { tone: "ok" | "error"; text: string } | null;

export default function LeadsPage() {
  const { workspaceId } = useActiveWorkspace();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<Set<string>>(new Set());
  const [service, setService] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sort, setSort] = useState("score");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showSearch, setShowSearch] = useState(false);
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [campaignFor, setCampaignFor] = useState<string[] | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [busy, setBusy] = useState(false);

  const base = workspaceId ? `/workspaces/${workspaceId}` : null;

  const loadLeads = useCallback(async () => {
    if (!base) return;
    try { setLeads(await api.get<Lead[]>(`${base}/leads?limit=5000`)); }
    catch (err) { setNotice({ tone: "error", text: err instanceof Error ? err.message : "Error al cargar leads" }); }
  }, [base]);

  const loadFollowUps = useCallback(async () => {
    if (!base) return;
    try {
      const result = await api.get<FollowUp[]>(`${base}/follow-ups`);
      setFollowUps(result.sort((a, b) => new Date(a.next_follow_up_at).getTime() - new Date(b.next_follow_up_at).getTime()));
    } catch { /* los seguimientos son secundarios en esta pantalla */ }
  }, [base]);

  useEffect(() => { loadLeads(); loadFollowUps(); }, [loadLeads, loadFollowUps]);

  // Filtros que llegan desde Inicio (?filtro=alta, ?servicio=web, ?pais=ES, ?estado=won, ?lead=id, ?buscar=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filtro");
    if (filter) setQuick(new Set([filter]));
    setService(params.get("servicio"));
    setCountry(params.get("pais"));
    setStatus(params.get("estado"));
    setOpenId(params.get("lead"));
    if (params.get("buscar")) { setShowSearch(true); setAutoFocusSearch(true); }
    try { const saved = window.localStorage.getItem(VIEW_KEY); if (saved === "table" || saved === "cards") setView(saved); } catch { /* sin almacenamiento */ }
  }, []);

  useEffect(() => { if (leads && leads.length === 0) setShowSearch(true); }, [leads]);
  useEffect(() => { setVisible(PAGE_SIZE); }, [query, quick, service, country, status, sort]);

  function changeView(next: "cards" | "table") {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* sin almacenamiento */ }
  }

  const filtered = useMemo(() => {
    const q = normalize(query);
    const list = (leads ?? []).filter((lead) =>
      (!q || normalize(`${lead.name} ${lead.category ?? ""} ${lead.email ?? ""} ${lead.address ?? ""}`).includes(q))
      && QUICK_FILTERS.every((item) => !quick.has(item.key) || item.test(lead))
      && (!service || lead.score_niche === service)
      && (!country || lead.country === country)
      && (!status || lead.status === status),
    );
    const sorters: Record<string, (a: Lead, b: Lead) => number> = {
      score: (a, b) => (b.lead_score ?? -1) - (a.lead_score ?? -1) || (b.reviews_count ?? 0) - (a.reviews_count ?? 0),
      reviews: (a, b) => (b.reviews_count ?? 0) - (a.reviews_count ?? 0),
      recent: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    };
    return list.sort(sorters[sort]);
  }, [leads, query, quick, service, country, status, sort]);

  const counts = useMemo(() => {
    const all = leads ?? [];
    return {
      quick: Object.fromEntries(QUICK_FILTERS.map((item) => [item.key, all.filter(item.test).length])),
      service: Object.fromEntries(Object.keys(SERVICE_META).map((key) => [key, all.filter((l) => l.score_niche === key).length])),
      country: Object.fromEntries(Object.keys(COUNTRY_META).map((key) => [key, all.filter((l) => l.country === key).length])),
    };
  }, [leads]);

  const shown = filtered.slice(0, visible);
  const openLead = leads?.find((lead) => lead.id === openId) ?? null;
  const hasFilters = !!(query || quick.size || service || country || status);

  function toggle(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function clearFilters() {
    setQuery(""); setQuick(new Set()); setService(null); setCountry(null); setStatus(null);
    window.history.replaceState(null, "", "/leads");
  }

  async function updateLead(id: string, body: Record<string, unknown>) {
    if (!base) return;
    const lead = leads?.find((item) => item.id === id);
    const updated = await api.patch<Lead>(`${base}/leads/${id}/status`, { status: lead?.status ?? "new", ...body });
    setLeads((prev) => prev?.map((item) => (item.id === id ? updated : item)) ?? null);
    loadFollowUps();
  }

  async function draft(ids: string[]): Promise<string> {
    if (!base) return "";
    const result = await api.post<OutreachActionResult>(`${base}/automation/outreach/draft`, { lead_ids: ids, min_score: 0 });
    return result.affected
      ? `✍️ Jarvis escribió ${result.affected} ${result.affected === 1 ? "mensaje" : "mensajes"}. Revísalos en "Aprobar mensajes".`
      : "No se escribió ningún mensaje: necesitan WhatsApp, estar en etapa Nuevo y no tener ya un mensaje.";
  }

  async function bulkDraft() {
    setBusy(true);
    try {
      setNotice({ tone: "ok", text: await draft(Array.from(selected)) });
      setSelected(new Set());
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "No se pudieron escribir los mensajes" });
    } finally { setBusy(false); }
  }

  async function openCampaign(ids: string[]) {
    setCampaignFor(ids);
    if (!base) return;
    try { setTemplates(await api.get<MessageTemplate[]>(`${base}/templates/messages`)); } catch { setTemplates([]); }
  }

  async function createCampaign() {
    if (!base || !campaignFor || !templateId) return;
    setBusy(true);
    try {
      await api.post(`${base}/campaigns`, {
        name: campaignName || `Campaña - ${new Date().toLocaleDateString("es-CO")}`,
        message_template_id: templateId,
        lead_ids: campaignFor,
      });
      setNotice({ tone: "ok", text: `Campaña creada con ${campaignFor.length} ${campaignFor.length === 1 ? "lead" : "leads"}.` });
      setCampaignFor(null); setSelected(new Set()); setCampaignName("");
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Error al crear la campaña" });
    } finally { setBusy(false); }
  }

  async function deleteLead(id: string) {
    if (!base) return;
    setDeleteId(null); setOpenId(null);
    try { await api.delete(`${base}/leads/${id}`); setLeads((prev) => prev?.filter((item) => item.id !== id) ?? null); }
    catch (err) { setNotice({ tone: "error", text: err instanceof Error ? err.message : "Error al eliminar" }); }
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = (selected.size ? filtered.filter((lead) => selected.has(lead.id)) : filtered).map((lead) => ({
      Negocio: lead.name,
      País: lead.country ? COUNTRY_META[lead.country]?.name ?? lead.country : "",
      Categoría: lead.category ?? "",
      Oportunidad: lead.lead_score ?? "",
      "Servicio recomendado": lead.score_niche ? SERVICE_META[lead.score_niche]?.label ?? "" : "",
      Etapa: statusMeta(lead.status).label,
      Teléfono: lead.phone ?? "",
      WhatsApp: lead.whatsapp ? `+${lead.whatsapp}` : "",
      Email: lead.email ?? "",
      "Sitio web": lead.website ?? "",
      Instagram: lead.instagram ?? "",
      Facebook: lead.facebook ?? "",
      Calificación: lead.rating ?? "",
      Reseñas: lead.reviews_count ?? "",
      Dirección: lead.address ?? "",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Leads");
    XLSX.writeFile(book, `jarvis_leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setNotice({ tone: "ok", text: `Exportados ${rows.length} leads a Excel.` });
  }

  async function updateFollowUp(path: string, body?: unknown) {
    if (!base) return;
    try { await api.patch(`${base}/follow-ups/${path}`, body); await loadFollowUps(); }
    catch (err) { setNotice({ tone: "error", text: err instanceof Error ? err.message : "Error al actualizar el seguimiento" }); }
  }

  return (
    <AppShell>
      <div className="space-y-5 pb-24">
        {/* Buscar clientes nuevos */}
        {showSearch ? (
          <div className="relative">
            <JarvisSearch workspaceId={workspaceId} autoFocus={autoFocusSearch} onDone={() => { loadLeads(); window.setTimeout(loadLeads, 30_000); }} />
            {!!leads?.length && (
              <button onClick={() => setShowSearch(false)} aria-label="Ocultar buscador" className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-dim hover:bg-white/5 hover:text-ink"><X size={15} /></button>
            )}
          </div>
        ) : (
          <button onClick={() => setShowSearch(true)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 text-left transition-colors hover:border-border-light hover:bg-card-hover">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-ink"><Sparkles size={17} /></span>
            <span>
              <span className="block text-[15px] font-semibold text-ink">Buscar clientes nuevos</span>
              <span className="text-[12.5px] text-ink-dim">Colombia, España o Estados Unidos · escribe &quot;rubro en ciudad&quot;</span>
            </span>
            <ChevronDown size={18} className="ml-auto text-ink-dim" />
          </button>
        )}

        {notice && (
          <div className={cn("flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[12px]", notice.tone === "ok" ? "border-accent/30 bg-accent/10 text-ink" : "border-red/30 bg-red/10 text-red")}>
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Cerrar aviso"><X size={14} /></button>
          </div>
        )}

        {/* Seguimientos pendientes */}
        {followUps.length > 0 && (
          <details className="group rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-6 py-4 text-[14px] font-medium text-ink">
              <CalendarClock size={16} className="text-violet" /> Seguimientos pendientes
              <span className="rounded-md bg-white/[0.06] px-2 text-[12px] tabular-nums text-ink-muted">{followUps.length}</span>
              {followUps.some((item) => item.status === "due") && <span className="rounded-full bg-amber/15 px-2 text-[10px] text-amber">hay vencidos</span>}
              <ChevronDown size={15} className="ml-auto text-ink-dim transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-2 px-6 pb-5 md:grid-cols-2 xl:grid-cols-3">
              {followUps.map((item) => {
                const lead = leads?.find((candidate) => candidate.id === item.lead_id);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-input px-3.5 py-3">
                    <button onClick={() => setOpenId(item.lead_id)} className="min-w-0 text-left">
                      <p className="truncate text-[12px] font-medium text-ink hover:text-violet">{lead?.name ?? "Lead"}</p>
                      <p className={cn("text-[10px]", item.status === "due" ? "text-amber" : "text-ink-muted")}>
                        {item.status === "due" ? "Vencido · " : ""}{new Date(item.next_follow_up_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button title="Hecho" onClick={() => updateFollowUp(`${item.id}/complete`)} className="rounded-md p-1.5 text-accent hover:bg-accent/10"><Check size={14} /></button>
                      <button title="Cancelar" onClick={() => updateFollowUp(`${item.id}/cancel`, { reason: "cancelled_by_user" })} className="rounded-md p-1.5 text-red hover:bg-red/10"><Ban size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Barra de herramientas y filtros */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex flex-1 items-center gap-2.5 rounded-xl border border-border bg-input px-3.5 py-2.5 focus-within:border-border-light">
              <Search size={16} className="text-ink-dim" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por nombre, categoría, email o dirección…"
                className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-dim" />
              {query && <button onClick={() => setQuery("")} aria-label="Borrar filtro"><X size={14} className="text-ink-dim" /></button>}
            </label>
            <div className="flex items-center gap-2">
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar"
                className="rounded-xl border border-border bg-input px-3 py-2.5 text-[13px] text-ink outline-none">
                {SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <div className="flex rounded-xl bg-input p-1">
                <button onClick={() => changeView("cards")} aria-label="Vista de tarjetas" className={cn("rounded-lg p-1.5", view === "cards" ? "bg-card-hover text-ink" : "text-ink-dim hover:text-ink")}><LayoutGrid size={15} /></button>
                <button onClick={() => changeView("table")} aria-label="Vista de tabla" className={cn("rounded-lg p-1.5", view === "table" ? "bg-card-hover text-ink" : "text-ink-dim hover:text-ink")}><List size={15} /></button>
              </div>
              <button onClick={() => { loadLeads(); loadFollowUps(); }} title="Actualizar" className="rounded-xl border border-border p-2.5 text-ink-muted hover:border-border-light hover:text-ink"><RefreshCw size={15} /></button>
              <button onClick={exportExcel} className="flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-[13px] font-medium text-ink-muted hover:border-border-light hover:text-ink"><Download size={15} /> Exportar</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((item) => (
              <button key={item.key}
                onClick={() => setQuick((prev) => { const next = new Set(prev); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors", quick.has(item.key) ? "border-border-light bg-white/[0.08] text-ink" : "border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                {item.label} <span className="tabular-nums text-ink-dim">{counts.quick[item.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12.5px] text-ink-dim">Servicio</span>
            {Object.entries(SERVICE_META).filter(([key]) => (counts.service[key] ?? 0) > 0).map(([key, meta]) => (
              <button key={key} onClick={() => setService(service === key ? null : key)}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors", service === key ? "border-border-light bg-white/[0.08] text-ink" : "border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} /> {meta.label} <span className="tabular-nums text-ink-dim">{counts.service[key]}</span>
              </button>
            ))}
            <span className="mx-2 h-5 w-px bg-border" />
            {Object.entries(COUNTRY_META).filter(([key]) => (counts.country[key] ?? 0) > 0).map(([key, meta]) => (
              <button key={key} onClick={() => setCountry(country === key ? null : key)} title={meta.name}
                className={cn("flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors", country === key ? "border-border-light bg-white/[0.08] text-ink" : "border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                <Flag code={key} /> <span className="tabular-nums text-ink-dim">{counts.country[key]}</span>
              </button>
            ))}
            {status && (
              <button onClick={() => setStatus(null)} className="flex items-center gap-1.5 rounded-lg border border-border-light bg-white/[0.08] text-ink px-3 py-1.5 text-[12.5px]">
                <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta(status).dot)} /> {statusMeta(status).label} <X size={12} />
              </button>
            )}
            {hasFilters && <button onClick={clearFilters} className="ml-auto text-[11px] font-semibold text-red hover:underline">Quitar filtros</button>}
          </div>
        </section>

        <div className="flex items-center justify-between px-1 text-[13px] text-ink-muted">
          <span><span className="font-semibold tabular-nums text-ink">{filtered.length}</span> {filtered.length === 1 ? "negocio" : "negocios"}{hasFilters ? " con estos filtros" : ""}</span>
          {filtered.length > 0 && (
            <button onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((lead) => lead.id)))} className="font-medium text-ink-muted hover:text-ink">
              {selected.size === filtered.length ? "Quitar selección" : `Seleccionar los ${filtered.length}`}
            </button>
          )}
        </div>

        {/* Resultados */}
        {leads === null ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-border/40 bg-card/60" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center">
            <Search size={30} className="mx-auto text-cyan" />
            <p className="mt-3 font-display text-lg font-bold text-ink">{leads.length ? "Ningún negocio coincide" : "Aún no tienes leads"}</p>
            <p className="mt-1 text-[12px] text-ink-muted">{leads.length ? "Prueba quitando algún filtro." : "Usa el buscador de arriba para traer tus primeros clientes."}</p>
            {hasFilters && <button onClick={clearFilters} className="mt-4 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-[12px] font-semibold text-cyan">Quitar filtros</button>}
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((lead) => (
              <LeadCard key={lead.id} lead={lead} selected={selected.has(lead.id)} onSelect={() => toggle(lead.id)} onOpen={() => setOpenId(lead.id)} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[860px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-border text-[12px] text-ink-dim">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-3 py-3 font-medium">Negocio</th>
                  <th className="px-3 py-3 font-medium">Oportunidad</th>
                  <th className="px-3 py-3 font-medium">Etapa</th>
                  <th className="px-3 py-3 font-medium">WhatsApp</th>
                  <th className="px-3 py-3 font-medium">Email</th>
                  <th className="px-3 py-3 font-medium">Reseñas</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((lead) => {
                  const meta = lead.score_niche ? SERVICE_META[lead.score_niche] : undefined;
                  const stage = statusMeta(lead.status);
                  return (
                    <tr key={lead.id} onClick={() => setOpenId(lead.id)} className={cn("cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-white/[0.02]", selected.has(lead.id) && "bg-white/[0.03]")}>
                      <td className="px-4 py-2.5" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggle(lead.id)} aria-label={`Seleccionar ${lead.name}`} className="h-4 w-4 accent-[#39ff88]" />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="flex items-center gap-1.5 font-medium text-ink"><Flag code={lead.country} /> {lead.name}</p>
                        <p className="text-[11px] text-ink-dim">{lead.category}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <ScoreRing score={lead.lead_score} size={32} />
                          {meta && <span className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted"><span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} />{meta.short}</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-ink-muted"><span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />{stage.label}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-ink-muted">{lead.whatsapp ? <span className="text-ink">+{lead.whatsapp}</span> : "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-[11px] text-ink-muted">{lead.email ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-ink-muted">{lead.rating ? `${lead.rating.toFixed(1)}★ · ${lead.reviews_count ?? 0}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visible < filtered.length && (
          <button onClick={() => setVisible(visible + PAGE_SIZE)} className="mx-auto flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:border-border-light hover:text-ink">
            Ver más ({filtered.length - visible} restantes) <ChevronDown size={14} />
          </button>
        )}
      </div>

      {/* Acciones sobre la selección */}
      {selected.size > 0 && (
        <div className="rise-in fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl border border-border-light bg-card-hover/95 p-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl lg:bottom-6 lg:left-64">
          <span className="px-3 text-[13px] text-ink-muted"><span className="font-semibold tabular-nums text-ink">{selected.size}</span> seleccionados</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={bulkDraft} disabled={busy} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />} Que Jarvis les escriba
            </button>
            <button onClick={() => openCampaign(Array.from(selected))} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-white/[0.05] hover:text-ink"><Megaphone size={15} /> Campaña</button>
            <button onClick={exportExcel} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-white/[0.05] hover:text-ink"><Download size={15} /> Exportar</button>
            <button onClick={() => setSelected(new Set())} aria-label="Quitar selección" className="rounded-lg px-2.5 text-ink-dim hover:bg-white/[0.05] hover:text-ink"><X size={16} /></button>
          </div>
        </div>
      )}

      <LeadDrawer
        lead={openLead}
        onClose={() => setOpenId(null)}
        onStatus={(next: LeadStatus) => updateLead(openLead!.id, { status: next })}
        onDoNotContact={(value) => updateLead(openLead!.id, { do_not_contact: value })}
        onDraft={() => draft([openLead!.id])}
        onCampaign={() => openCampaign([openLead!.id])}
        onDelete={() => setDeleteId(openLead!.id)}
      />

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Eliminar lead</DialogTitle>
        <DialogDescription>Se borrará el negocio y sus mensajes. Esta acción no se puede deshacer.</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteId && deleteLead(deleteId)}>Eliminar</Button>
        </div>
      </Dialog>

      <Dialog open={!!campaignFor} onClose={() => setCampaignFor(null)}>
        <DialogTitle>Crear campaña</DialogTitle>
        <DialogDescription>Con {campaignFor?.length ?? 0} {campaignFor?.length === 1 ? "lead" : "leads"}. Elige la plantilla del mensaje.</DialogDescription>
        <div className="mt-5 space-y-4">
          <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder={`Campaña - ${new Date().toLocaleDateString("es-CO")}`}
            className="w-full rounded-xl border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink outline-none focus:border-border-light" />
          {templates.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {templates.map((template) => (
                <button key={template.id} onClick={() => setTemplateId(template.id)}
                  className={cn("w-full rounded-xl border p-3 text-left transition-colors", templateId === template.id ? "border-accent/60 bg-white/[0.04]" : "border-border bg-input hover:border-border-light")}>
                  <p className="text-[12px] font-medium text-ink">{template.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-dim">{template.content}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-dim">No hay plantillas. Crea una en <a href="/templates" className="text-ink underline">Plantillas</a>.</p>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCampaignFor(null)}>Cancelar</Button>
          <button onClick={createCampaign} disabled={busy || !templateId} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} Crear campaña
          </button>
        </div>
      </Dialog>
    </AppShell>
  );
}
