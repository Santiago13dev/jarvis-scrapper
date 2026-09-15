"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Globe, Megaphone, Phone, RefreshCw, Search, Sparkles, Trash2, ChevronDown,
  Star, Download, Mail, MapPin, Edit3, ExternalLink, X, Filter,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { Lead, LeadStatus, MessageTemplate, Campaign } from "@/types/api";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";

const BogotaMapMini = dynamic(
  () => import("@/components/ui/bogota-map-inner").then((m) => m.BogotaMapInner),
  { ssr: false }
);

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "Nuevo" },
  { value: "contacted", label: "Contactado" },
  { value: "replied", label: "Respondido" },
  { value: "qualified", label: "Calificado" },
  { value: "demo_sent", label: "Demo enviado" },
  { value: "won", label: "Ganado" },
  { value: "lost", label: "Perdido" },
];

const SAMPLE_LEADS = [
  { id: "1", name: "La Carreta", category: "Restaurante Cubano", phone: "+57 310-456-7890", email: "info@lacarretabogota.com", website: "lacarretabogota.com", rating: 4.6, reviews: 230, address: "Cra 13 #85-32, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
  { id: "2", name: "Sushi Maki", category: "Restaurante Japonés", phone: "+57 315-123-4567", email: "hello@sushimaki.co", website: "sushimaki.co", rating: 4.7, reviews: 185, address: "Cra 11 #93-78, Zona T, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
  { id: "3", name: "Miami Grill", category: "Restaurante Americano", phone: "+57 300-654-3210", email: "contact@miamigrill.com", website: "miamigrill.com", rating: 4.7, reviews: 142, address: "Cra 7 #72-41, Zona G, Bogotá", date: "15 May 2024 14:30", status: "contacted" as LeadStatus },
  { id: "4", name: "Green Vita", category: "Restaurante Saludable", phone: "+57 321-987-6543", email: "info@greenvita.co", website: "greenvita.co", rating: 4.8, reviews: 310, address: "Cra 6 #67-23, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "qualified" as LeadStatus },
  { id: "5", name: "Pizza Palace", category: "Pizzería", phone: "+57 318-876-5432", email: "order@pizzapalace.co", website: "pizzapalace.co", rating: 4.3, reviews: 98, address: "Cra 15 #80-20, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
  { id: "6", name: "Burger House", category: "Hamburguesería", phone: "+57 301-321-9876", email: "info@burgerhouse.co", website: "burgerhouse.co", rating: 4.4, reviews: 205, address: "Cra 9 #75-70, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
  { id: "7", name: "Café Downtown", category: "Cafetería", phone: "+57 300-555-0123", email: "hello@cafedowntown.co", website: "cafedowntown.co", rating: 4.5, reviews: 175, address: "Cra 2 #11-41, La Candelaria, Bogotá", date: "15 May 2024 14:30", status: "contacted" as LeadStatus },
  { id: "8", name: "Taco City", category: "Restaurante Mexicano", phone: "+57 312-000-1111", email: "info@tacocity.co", website: "tacocity.co", rating: 4.2, reviews: 120, address: "Cra 14 #82-10, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
  { id: "9", name: "Poke Fresh", category: "Restaurante Saludable", phone: "+57 300-456-3333", email: "info@pokefresh.co", website: "pokefresh.co", rating: 4.7, reviews: 190, address: "Cra 11 #85-32, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "qualified" as LeadStatus },
  { id: "10", name: "Sweet Bakery", category: "Panadería", phone: "+57 310-789-1122", email: "contact@sweetbakery.co", website: "sweetbakery.co", rating: 4.9, reviews: 340, address: "Cra 5 #60-15, Chapinero, Bogotá", date: "15 May 2024 14:30", status: "new" as LeadStatus },
];

function StarRating({ rating, size = 14 }: { rating: number | null; size?: number }) {
  if (!rating) return <span className="text-[11px] text-ink-dim">—</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(rating) ? "text-amber fill-amber" : "text-border/50"} />
      ))}
    </div>
  );
}

export default function LeadsPage() {
  const { workspaceId, loading } = useActiveWorkspace();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [form, setForm] = useState({ keyword: "restaurantes", location: "Bogotá, Colombia", depth: 2 });
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<{id: string; name: string; category: string; phone: string; email: string; website: string; rating: number; reviews: number; address: string; date: string; status: string} | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const perPage = 10;

  async function loadLeads(wsId: string) {
    try { const result = await api.get<Lead[]>(`/workspaces/${wsId}/leads`); setLeads(result); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al cargar leads"); }
  }

  useEffect(() => { if (workspaceId) loadLeads(workspaceId); }, [workspaceId]);

  async function handleImport() {
    if (!workspaceId) return; setImporting(true); setImportModalOpen(false); setError(null); setSuccessMsg(null);
    try {
      await api.post(`/workspaces/${workspaceId}/leads/import`, { keyword: form.keyword, location: form.location, max_results: 500, depth: form.depth });
      setSuccessMsg("Scrape en progreso... buscando leads en Google Maps");
      for (let attempt = 0; attempt < 24; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        const result = await api.get<Lead[]>(`/workspaces/${workspaceId}/leads`);
        if (result && result.length > 0) { setLeads(result); setSuccessMsg(`Se encontraron ${result.length} leads`); setTimeout(() => setSuccessMsg(null), 5000); break; }
      }
    }
    catch (err) { setError(err instanceof Error ? err.message : "Error al importar"); }
    finally { setImporting(false); }
  }

  async function handleDeleteLead(leadId: string) {
    if (!workspaceId) return; setDeleteConfirmId(null);
    try { await api.delete(`/workspaces/${workspaceId}/leads/${leadId}`); await loadLeads(workspaceId); setSelectedLead(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al eliminar"); }
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    if (!workspaceId) return;
    try { await api.patch(`/workspaces/${workspaceId}/leads/${leadId}/status`, { status: newStatus }); await loadLeads(workspaceId); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  function toggleSelect(id: string) { setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleAll() { setSelectedIds(selectedIds.size === displayLeads.length ? new Set() : new Set(displayLeads.map((l) => l.id))); }

  async function loadCampaignsAndTemplates() {
    if (!workspaceId) return;
    try {
      const [c, t] = await Promise.all([
        api.get<Campaign[]>(`/workspaces/${workspaceId}/campaigns`),
        api.get<MessageTemplate[]>(`/workspaces/${workspaceId}/templates/messages`),
      ]);
      setCampaigns(c);
      setTemplates(t);
    } catch {}
  }

  async function handleAddToCampaign(leadId: string) {
    if (!workspaceId || !selectedTemplateId) return;
    setCreatingCampaign(true);
    try {
      await api.post(`/workspaces/${workspaceId}/campaigns`, {
        name: campaignName || `Campaña - ${new Date().toLocaleDateString("es-CO")}`,
        message_template_id: selectedTemplateId,
        lead_ids: [leadId],
      });
      setCampaignModalOpen(false);
      setSuccessMsg("Lead agregado a nueva campaña");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear campaña");
    } finally {
      setCreatingCampaign(false);
    }
  }

  async function handleAddSelectedToCampaign() {
    if (!workspaceId || !selectedTemplateId || selectedIds.size === 0) return;
    setCreatingCampaign(true);
    try {
      await api.post(`/workspaces/${workspaceId}/campaigns`, {
        name: campaignName || `Campaña - ${new Date().toLocaleDateString("es-CO")}`,
        message_template_id: selectedTemplateId,
        lead_ids: Array.from(selectedIds),
      });
      setCampaignModalOpen(false);
      setSelectedIds(new Set());
      setSuccessMsg(`${selectedIds.size} leads agregados a nueva campaña`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear campaña");
    } finally {
      setCreatingCampaign(false);
    }
  }

  function handleExport() {
    const leadsToExport = selectedIds.size > 0
      ? displayLeads.filter((l) => selectedIds.has(l.id))
      : displayLeads;
    const data = leadsToExport.map((l) => ({
      Negocio: l.name,
      Categoría: l.category,
      Teléfono: l.phone,
      Email: l.email,
      "Sitio Web": l.website,
      Calificación: l.rating ?? "",
      "N.° Reseñas": l.reviews ?? "",
      Dirección: l.address,
      Estado: l.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    ws["!cols"] = [
      { wch: 30 }, { wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 25 },
      { wch: 10 }, { wch: 10 }, { wch: 40 }, { wch: 12 },
    ];
    XLSX.writeFile(wb, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setSuccessMsg(`Exportados ${leadsToExport.length} leads a Excel`);
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  const displayLeads = useMemo(() => {
    const base = (leads ?? []).map((l) => ({
          id: l.id,
          name: l.name || "Sin nombre",
          category: l.category || "General",
          phone: l.phone || "—",
          email: l.email || "—",
          website: l.website || "—",
          rating: l.rating || null,
          reviews: l.reviews_count || null,
          address: l.address || "—",
          date: new Date(l.created_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }),
          status: l.status || "new",
        }));
    let filtered = base;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((l) => l.name.toLowerCase().includes(q) || l.category.toLowerCase().includes(q) || l.email.toLowerCase().includes(q));
    }
    if (activeFilters.has("Tiene email")) filtered = filtered.filter((l) => l.email && l.email !== "—");
    if (activeFilters.has("Tiene teléfono")) filtered = filtered.filter((l) => l.phone && l.phone !== "—");
    if (activeFilters.has("Tiene sitio web")) filtered = filtered.filter((l) => l.website && l.website !== "—");
    if (activeFilters.has("Sin sitio web")) filtered = filtered.filter((l) => !l.website || l.website === "—");
    if (minRating > 0) filtered = filtered.filter((l) => l.rating && l.rating >= minRating);
    return filtered;
  }, [searchQuery, leads, activeFilters, minRating]);

  const paginatedLeads = displayLeads.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(displayLeads.length / perPage);

  const isAuthenticated = !!workspaceId;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Error Banner */}
        {error && (
          <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 flex items-center justify-between">
            <span className="text-[12px] text-red font-medium">{error}</span>
            <button onClick={() => setError(null)} className="text-red hover:text-red/80 transition-colors"><X size={14} /></button>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 flex items-center justify-between">
            <span className="text-[12px] text-teal font-medium">{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-teal hover:text-teal/80 transition-colors"><X size={14} /></button>
          </div>
        )}

        {/* Not authenticated banner */}
        {!loading && !isAuthenticated && (
          <div className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-amber font-medium">No estás autenticado. Iniciá sesión para importar leads y guardar datos.</span>
            </div>
            <a href="/login" className="rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors">Iniciar sesión</a>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Leads</h1>
            <p className="text-[12px] text-ink-muted mt-0.5">Gestiona y explora todos los leads extraídos de Google Maps</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-3 py-2">
              <Search size={14} className="text-ink-dim" />
              <input type="text" placeholder="Buscar leads, negocios, categorías..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="bg-transparent text-[12px] text-ink placeholder:text-ink-dim outline-none w-56" />
              <span className="text-[10px] text-ink-dim border border-border/30 rounded px-1.5 py-0.5">⌘ K</span>
            </div>
            <button className="rounded-lg border border-border/50 bg-input p-2 text-ink-muted hover:text-ink transition-colors relative">
              <Filter size={16} />
            </button>
            <button onClick={() => { if (!isAuthenticated) { setError("Iniciá sesión para importar leads desde Google Maps"); return; } setImportModalOpen(true); }} disabled={importing}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50">
              {importing ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              {importing ? "Importando..." : "Importar desde Google Maps"}
            </button>
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[11px] font-bold text-accent">SR</span>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(() => {
            const allLeads = leads ?? [];
            const withEmail = allLeads.filter((l) => l.email && l.email !== "—");
            const withPhone = allLeads.filter((l) => l.phone && l.phone !== "—");
            const withWeb = allLeads.filter((l) => l.website && l.website !== "—");
            const stats = [
              { label: "Leads extraídos", value: allLeads.length.toLocaleString(), icon: Users, color: "bg-accent/15 text-accent", trend: "+18.5%" },
              { label: "Correos encontrados", value: withEmail.length.toLocaleString(), icon: Mail, color: "bg-blue/15 text-blue", trend: "+14.2%" },
              { label: "Teléfonos encontrados", value: withPhone.length.toLocaleString(), icon: Phone, color: "bg-teal/15 text-teal", trend: "+16.8%" },
              { label: "Sitios web encontrados", value: withWeb.length.toLocaleString(), icon: Globe, color: "bg-amber/15 text-amber", trend: "+12.6%" },
              { label: "Direcciones encontrados", value: allLeads.filter((l) => l.address && l.address !== "—").length.toLocaleString(), icon: MapPin, color: "bg-pink/15 text-pink", trend: "+18.5%" },
            ];
            return stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-xl border border-border/40 bg-card p-4 transition-all hover:border-accent/20">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-lg p-2 ${stat.color}`}><Icon size={15} /></div>
                    <span className="text-[10px] text-teal font-medium">{stat.trend}</span>
                  </div>
                  <p className="text-lg font-bold text-ink font-mono-data mt-2">{stat.value}</p>
                  <p className="text-[10px] text-ink-dim mt-0.5">{stat.label}</p>
                  <p className="text-[9px] text-ink-dim/60 mt-0.5">vs. último mes</p>
                </div>
              );
            });
          })()}
        </div>

        {/* Filter bar */}
        <div className="rounded-lg border border-border/40 bg-card p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-[13px] font-medium text-ink">Google Maps — Restaurantes en Bogotá</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-[9px] font-semibold text-teal uppercase tracking-wider">
                <span className="h-1 w-1 rounded-full bg-teal" /> Completado
              </span>
              <span className="text-[12px] text-ink-muted">{(leads?.length || SAMPLE_LEADS.length).toLocaleString()} leads</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-border/50 bg-input p-2 text-ink-muted hover:text-ink transition-colors"><RefreshCw size={14} /></button>
              <button onClick={handleExport} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors">
                <Download size={13} /> Exportar
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {["Tiene email", "Tiene teléfono", "Tiene sitio web", "Sin sitio web"].map((f) => (
              <button key={f} onClick={() => { setPage(1); setActiveFilters((prev) => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; }); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${activeFilters.has(f) ? "border-accent/40 bg-accent/10 text-accent" : "border-border/40 bg-input text-ink-muted hover:text-ink hover:border-border"}`}>
                {f}
              </button>
            ))}
            <span className="w-px h-4 bg-border/30" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-ink-dim mr-1">Mín.</span>
              {[0, 3, 3.5, 4, 4.5].map((r) => (
                <button key={r} onClick={() => { setMinRating(r); setPage(1); }}
                  className={`flex items-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${minRating === r ? "bg-accent/10 text-accent border border-accent/30" : "text-ink-dim hover:text-ink border border-transparent"}`}>
                  {r === 0 ? "Todas" : <><Star size={10} className="text-amber fill-amber" />{r}+</>}
                </button>
              ))}
            </div>
            {(activeFilters.size > 0 || minRating > 0) && (
              <button onClick={() => { setActiveFilters(new Set()); setMinRating(0); setPage(1); }} className="text-[11px] text-red font-medium hover:text-red/80 transition-colors">Borrar filtros</button>
            )}
          </div>
        </div>

        {/* Main content: Table + Detail Panel */}
        <div className="flex flex-col gap-4 xl:flex-row">
          {/* Table */}
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border/40 bg-card">
            <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-wider text-ink-dim">
                  <th className="px-4 py-3 font-medium w-8">
                    <input type="checkbox" checked={selectedIds.size === paginatedLeads.length && paginatedLeads.length > 0} onChange={toggleAll} className="rounded border-border accent-[#825aff]" />
                  </th>
                  <th className="px-3 py-3 font-medium min-w-[160px]">Negocio</th>
                  <th className="px-3 py-3 font-medium min-w-[140px]">Categoría</th>
                  <th className="px-3 py-3 font-medium min-w-[120px]">Teléfono</th>
                  <th className="px-3 py-3 font-medium min-w-[140px]">Email</th>
                  <th className="px-3 py-3 font-medium min-w-[140px]">Sitio Web</th>
                  <th className="px-3 py-3 font-medium min-w-[100px]">Calificación</th>
                  <th className="px-3 py-3 font-medium min-w-[160px]">Dirección</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Fecha extraída</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead) => (
                  <tr key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`border-b border-border/20 hover:bg-card-hover transition-colors cursor-pointer ${selectedLead?.id === lead.id ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-border accent-[#825aff]" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink whitespace-nowrap">{lead.name}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-border/20 px-2 py-0.5 text-[11px] text-ink-muted">{lead.category}</span>
                    </td>
                    <td className="px-3 py-3">
                      {lead.phone && lead.phone !== "—" ? (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-ink-muted"><Phone size={10} /> {lead.phone}</span>
                      ) : <span className="text-ink-dim text-[11px]">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px]">
                      {lead.email && lead.email !== "—" ? <span className="text-accent">{lead.email}</span> : <span className="text-ink-dim">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {lead.website && lead.website !== "—" ? (
                        <span className="flex items-center gap-1 text-accent text-[11px]"><Globe size={10} /> {lead.website}</span>
                      ) : <span className="text-ink-dim text-[11px]">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {lead.rating ? <span className="text-ink font-medium text-[11px]">{lead.rating}</span> : null}
                        <StarRating rating={lead.rating} size={11} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-ink-dim text-[11px] max-w-[140px] truncate">{lead.address}</td>
                    <td className="px-3 py-3 text-ink-dim text-[11px] whitespace-nowrap">{lead.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {/* Pagination */}
            <div className="flex flex-col gap-2 border-t border-border/20 bg-card/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] text-ink-dim">Mostrando {((page - 1) * perPage) + 1} a {Math.min(page * perPage, displayLeads.length)} de {displayLeads.length} leads</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`h-6 min-w-[24px] rounded px-1.5 text-[10px] font-medium transition-colors ${p === page ? "bg-accent text-white" : "text-ink-dim hover:text-ink hover:bg-card-hover"}`}>{p}</button>
                ))}
              </div>
              <span className="text-[10px] text-ink-dim">10 por página</span>
            </div>
          </div>

          {/* Detail Panel */}
          {selectedLead && (
            <div className="w-full shrink-0 overflow-hidden rounded-lg border border-border/40 bg-card xl:w-[340px]">
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
                      <span className="font-bold text-accent text-sm">{selectedLead.name[0]}</span>
                    </div>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-ink">{selectedLead.name}</h3>
                      <p className="text-[11px] text-ink-muted">{selectedLead.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="rounded-md p-1.5 text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"><Edit3 size={13} /></button>
                    <button className="rounded-md p-1.5 text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"><ExternalLink size={13} /></button>
                    <button onClick={() => setSelectedLead(null)} className="rounded-md p-1.5 text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"><X size={13} /></button>
                  </div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-bold text-ink">{selectedLead.rating}</span>
                  <StarRating rating={selectedLead.rating} size={14} />
                  <span className="text-[11px] text-ink-muted">({selectedLead.reviews} reseñas)</span>
                </div>

                {/* Contact */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center gap-2.5">
                    <Phone size={13} className="text-ink-dim shrink-0" />
                    <span className="text-[12px] text-ink font-mono">{selectedLead.phone}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail size={13} className="text-ink-dim shrink-0" />
                    <span className="text-[12px] text-accent">{selectedLead.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Globe size={13} className="text-ink-dim shrink-0" />
                    <span className="text-[12px] text-accent">{selectedLead.website}</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <MapPin size={13} className="text-ink-dim shrink-0 mt-0.5" />
                    <span className="text-[12px] text-ink-muted">{selectedLead.address}</span>
                  </div>
                </div>

                {/* Map mini */}
                <div className="rounded-lg overflow-hidden border border-border/30 mb-4 h-[120px]">
                  <BogotaMapMini />
                </div>

                {/* Details grid */}
                <div className="space-y-2.5 mb-4 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Categoría</span>
                    <span className="text-ink font-medium">{selectedLead.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Fuente</span>
                    <span className="text-ink font-medium">Google Maps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-dim">Fecha de extracción</span>
                    <span className="text-ink font-medium">{selectedLead.date}</span>
                  </div>
                </div>

                {/* Campaign tags */}
                <div className="mb-4">
                  <p className="text-[10px] text-ink-dim uppercase tracking-wider mb-2">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Restaurante", "Cubano", "Chapinero"].map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">{tag}</span>
                    ))}
                    <button className="inline-flex items-center rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-ink-dim hover:text-ink hover:border-border transition-colors">+</button>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-4">
                  <p className="text-[10px] text-ink-dim uppercase tracking-wider mb-1.5">Notas</p>
                  <p className="text-[12px] text-ink-muted leading-relaxed">Restaurante cubano tradicional con excelente reputación.</p>
                  <button className="text-[11px] text-accent hover:text-accent-hover mt-1 flex items-center gap-1"><Edit3 size={10} /> Editar notas</button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button onClick={() => { loadCampaignsAndTemplates(); setCampaignModalOpen(true); }} className="flex-1 bg-accent hover:bg-accent-hover text-white text-[12px]"><Megaphone size={13} /> Agregar a campaña</Button>
                  <Button variant="secondary" className="text-[12px]">Acciones</Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom section: Charts + Activity */}
        <div className="grid grid-cols-3 gap-4">
          {/* Fuentes principales */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[13px] font-bold text-ink">Fuentes principales</h3>
              <span className="text-[10px] text-ink-dim">Últimos 30 días</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-[100px] h-[100px] shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(var(--border)/0.3)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#825aff" strokeWidth="3" strokeDasharray="68 32" strokeDashoffset="0" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#00d296" strokeWidth="3" strokeDasharray="22 78" strokeDashoffset="-68" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#468cff" strokeWidth="3" strokeDasharray="7 93" strokeDashoffset="-90" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ff8050" strokeWidth="3" strokeDasharray="3 97" strokeDashoffset="-97" />
                </svg>
              </div>
              <div className="space-y-2 flex-1">
                {[
                  { name: "Google Maps", pct: "68%", count: "8,512", color: "#825aff" },
                  { name: "Scraper Web", pct: "22%", count: "2,765", color: "#00d296" },
                  { name: "Importación", pct: "7%", count: "854", color: "#468cff" },
                  { name: "Dominios & Emails", pct: "3%", count: "409", color: "#ff8050" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                      <span className="text-[11px] text-ink-muted">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink font-medium">{s.pct}</span>
                      <span className="text-[10px] text-ink-dim">({s.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Leads por categoría */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[13px] font-bold text-ink">Leads por categoría</h3>
              <span className="text-[10px] text-ink-dim">Últimos 30 días</span>
            </div>
            <div className="space-y-3">
              {[
                { name: "Restaurantes", pct: "35%", count: "4,388", width: "35%" },
                { name: "Salud & Belleza", pct: "20%", count: "2,765", width: "20%" },
                { name: "Retail", pct: "15%", count: "1,881", width: "15%" },
                { name: "Servicios", pct: "10%", count: "1,254", width: "10%" },
                { name: "Otros", pct: "20%", count: "2,508", width: "20%" },
              ].map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-ink-muted">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink font-medium">{c.pct}</span>
                      <span className="text-[10px] text-ink-dim">({c.count})</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: c.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calificación promedio + Activity */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-card p-5 text-center">
              <h3 className="font-display text-[13px] font-bold text-ink mb-3">Calificación promedio</h3>
              <p className="text-[10px] text-ink-dim mb-2">Últimos 30 días</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-display font-bold text-ink">4.6</span>
                <span className="text-lg text-ink-dim">/ 5</span>
              </div>
              <StarRating rating={4.6} size={16} />
              <p className="text-[10px] text-ink-dim mt-2">Basado en 12,540 negocios</p>
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-[13px] font-bold text-ink">Actividad reciente</h3>
                <button className="text-[11px] text-accent hover:text-accent-hover">Ver todo</button>
              </div>
              <div className="space-y-3">
                {[
                  { action: "Google Maps — Restaurantes Bogotá", detail: "Completado · 1,250 leads", time: "15 May 2024 14:30", color: "bg-teal" },
                  { action: "Google Maps — Dentistas Bogotá", detail: "Completado · 950 leads", time: "14 May 2024 10:15", color: "bg-accent" },
                ].map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${a.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-ink font-medium truncate">{a.action}</p>
                      <p className="text-[10px] text-ink-dim">{a.detail}</p>
                    </div>
                    <span className="text-[9px] text-ink-dim shrink-0">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Eliminar lead</DialogTitle>
        <DialogDescription>¿Seguro que querés eliminar este lead?</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDeleteLead(deleteConfirmId)}><Trash2 size={14} /> Eliminar</Button>
        </div>
      </Dialog>

      <Dialog open={importModalOpen} onClose={() => setImportModalOpen(false)}>
        <DialogTitle>Importar leads desde Google Maps</DialogTitle>
        <DialogDescription>Configurá los parámetros de búsqueda.</DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Qué buscar</label>
            <input type="text" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Ubicación</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Profundidad</label>
            <div className="flex items-center gap-3">
              {[1, 2, 3].map((d) => (
                <button key={d} onClick={() => setForm({ ...form, depth: d })}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[13px] font-medium transition-all ${form.depth === d ? "border-accent/40 bg-accent/10 text-accent" : "border-border/50 bg-input text-ink-muted hover:text-ink"}`}>{d}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setImportModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing} className="bg-accent hover:bg-accent-hover text-white">
            {importing ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {importing ? "Importando..." : "Buscar"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={campaignModalOpen} onClose={() => setCampaignModalOpen(false)}>
        <DialogTitle>Agregar a campaña</DialogTitle>
        <DialogDescription>Crea una nueva campaña con {selectedLead ? `el lead "${selectedLead.name}"` : `${selectedIds.size} leads seleccionados`}.</DialogDescription>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Nombre de la campaña</label>
            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              placeholder={`Campaña - ${new Date().toLocaleDateString("es-CO")}`}
              className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-ink-muted uppercase tracking-wider">Plantilla de mensaje</label>
            {templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTemplateId(t.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedTemplateId === t.id ? "border-accent/40 bg-accent/10" : "border-border/40 bg-input hover:border-border"}`}>
                    <p className="text-[12px] font-medium text-ink">{t.name}</p>
                    <p className="text-[11px] text-ink-dim mt-0.5 truncate">{t.content}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-ink-dim">No hay plantillas creadas. Creá una en <a href="/templates" className="text-accent hover:underline">Plantillas</a>.</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCampaignModalOpen(false)}>Cancelar</Button>
          <Button onClick={() => selectedLead ? handleAddToCampaign(selectedLead.id) : handleAddSelectedToCampaign()}
            disabled={creatingCampaign || !selectedTemplateId} className="bg-accent hover:bg-accent-hover text-white">
            {creatingCampaign ? <RefreshCw size={14} className="animate-spin" /> : <Megaphone size={14} />}
            {creatingCampaign ? "Creando..." : "Crear campaña"}
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}

function Users(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width={props.size||24} height={props.size||24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
