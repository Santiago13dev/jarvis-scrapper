"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { DashboardSummary } from "@/types/api";
import {
  Users,
  Megaphone,
  MessageCircle,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  MapPin,
  Phone,
  Globe,
  Star,
  ExternalLink,
  Search,
} from "lucide-react";
import { BogotaMap } from "@/components/ui/bogota-map";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const STAT_CONFIG: {
  key: keyof DashboardSummary;
  label: string;
  icon: typeof Users;
  color: string;
  trend: string;
  trendUp: boolean;
  format?: (v: number) => string;
}[] = [
  {
    key: "total_leads",
    label: "Negocios extraídos",
    icon: Users,
    color: "bg-accent/15 text-accent",
    trend: "+18.5%",
    trendUp: true,
    format: (v) => v.toLocaleString(),
  },
  {
    key: "total_campaigns_active",
    label: "Campañas activas",
    icon: Megaphone,
    color: "bg-teal/15 text-teal",
    trend: "+6.3%",
    trendUp: true,
  },
  {
    key: "total_conversations_open",
    label: "Conversaciones",
    icon: MessageCircle,
    color: "bg-blue/15 text-blue",
    trend: "+14.2%",
    trendUp: true,
  },
  {
    key: "average_lead_score",
    label: "Precisión de datos",
    icon: TrendingUp,
    color: "bg-amber/15 text-amber",
    trend: "+2.4%",
    trendUp: true,
    format: (v) => `${v.toFixed(1)}%`,
  },
];

const AREA_DATA = [
  { day: "1 Mar", value: 450 },
  { day: "5 Mar", value: 720 },
  { day: "10 Mar", value: 580 },
  { day: "15 Mar", value: 1250 },
  { day: "20 Mar", value: 980 },
  { day: "25 Mar", value: 1100 },
  { day: "30 Mar", value: 850 },
];

const PIE_DATA = [
  { name: "Restaurantes", value: 35, color: "#825aff" },
  { name: "Salud & Belleza", value: 20, color: "#00d296" },
  { name: "Retail", value: 15, color: "#ff8050" },
  { name: "Servicios", value: 10, color: "#468cff" },
  { name: "Otros", value: 20, color: "#e650b4" },
];

const BAR_DATA = [
  { source: "Google Maps", value: 7542, color: "#825aff" },
  { source: "Scraper Web", value: 2840, color: "#00d296" },
  { source: "Dominios & Email", value: 1250, color: "#468cff" },
  { source: "Importación", value: 1298, color: "#ff8050" },
];

const SAMPLE_LEADS = [
  {
    name: "La Carreta",
    category: "Restaurante Cubano",
    phone: "+57 310-456-7890",
    email: "info@lacarretabogota.com",
    website: "lacarretabogota.com",
    rating: 4.6,
    reviews: 230,
    address: "Cra 13 #85-32, Chapinero",
  },
  {
    name: "Café San Alberto",
    category: "Cafetería Especialidad",
    phone: "+57 315-123-4567",
    email: "hola@sanalberto.co",
    website: "sanalberto.co",
    rating: 4.8,
    reviews: 412,
    address: "Cra 7 #72-41, Zona G",
  },
  {
    name: "Wok",
    category: "Restaurante Asiático",
    phone: "+57 300-654-3210",
    email: "reservas@wokbogota.com",
    website: "wokbogota.com",
    rating: 4.4,
    reviews: 185,
    address: "Cra 11 #93-78, Zona T",
  },
  {
    name: "Prudencia",
    category: "Cocina Colombiana",
    phone: "+57 321-987-6543",
    email: "info@prudencia.co",
    website: "prudencia.co",
    rating: 4.7,
    reviews: 310,
    address: "Cra 6 #67-23, Chapinero",
  },
  {
    name: "Masa Madre",
    category: "Panadería Artesanal",
    phone: "+57 318-876-5432",
    email: "pedidos@masamadre.co",
    website: "masamadre.co",
    rating: 4.5,
    reviews: 198,
    address: "Cra 7 #72-15, Zona G",
  },
  {
    name: "Harry Sasson",
    category: "Restaurante de Autor",
    phone: "+57 301-321-9876",
    email: "reservas@harrysasson.com",
    website: "harrysasson.com",
    rating: 4.9,
    reviews: 520,
    address: "Cra 9 #75-70, Chapinero",
  },
  {
    name: "La Puerta Falsa",
    category: "Ajiaco y Tamales",
    phone: "+57 300-555-0123",
    email: "info@lapuertafalsa.co",
    website: "lapuertafalsa.co",
    rating: 4.3,
    reviews: 890,
    address: "Cra 2 #11-41, La Candelaria",
  },
];

export default function DashboardPage() {
  const { workspaceId, loading: workspaceLoading } = useActiveWorkspace();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<DashboardSummary>(`/workspaces/${workspaceId}/dashboard/summary`)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Error"));
  }, [workspaceId]);

  const displaySummary = summary;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CONFIG.map((stat) => {
            const value = displaySummary ? displaySummary[stat.key] : null;
            const Icon = stat.icon;
            return (
              <div
                key={stat.key}
                className="rounded-xl border border-border/40 bg-card p-5 transition-all hover:border-accent/20 hover:bg-card-hover"
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg p-2.5 ${stat.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className={`flex items-center gap-1 text-[11px] font-medium ${stat.trendUp ? "text-teal" : "text-red"}`}>
                    {stat.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {stat.trend}
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-ink font-mono-data">
                    {value !== null
                      ? (stat.format ? stat.format(value) : value.toLocaleString())
                      : <span className="inline-block h-7 w-16 animate-pulse rounded bg-border/30" />
                    }
                  </p>
                  <p className="text-[11px] text-ink-muted mt-1">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Middle section: Activity panel + Map area */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Activity / Scraper panel */}
          <div className="lg:col-span-3 rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-bold text-ink">Google Maps Scraper</h3>
                <p className="text-[11px] text-ink-muted mt-0.5">Restaurantes en Bogotá, Colombia</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2.5 py-1 text-[10px] font-semibold text-teal uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Completado
              </span>
            </div>

            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-dim uppercase tracking-wider">Fecha</span>
                <span className="text-[12px] text-ink font-medium">15 Mayo 2024</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-dim uppercase tracking-wider">Ubicación</span>
                <span className="text-[12px] text-ink font-medium">Bogotá, Colombia</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-dim uppercase tracking-wider">Categoría</span>
                <span className="text-[12px] text-ink font-medium">Restaurantes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-dim uppercase tracking-wider">Negocios</span>
                <span className="text-[12px] text-ink font-medium">1,250</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-ink-dim uppercase tracking-wider">Progreso de extracción</span>
                <span className="text-[12px] text-accent font-bold font-mono">100%</span>
              </div>
              <div className="h-2 rounded-full bg-border/30 overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: "100%" }} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-4 py-2 text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border transition-colors">
                <BarChart3 size={14} />
                Ver detalles
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-4 py-2 text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border transition-colors">
                <Users size={14} />
                Ver leads (1,250)
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[12px] font-medium text-white hover:bg-accent-hover transition-colors">
                <Download size={14} />
                Exportar
              </button>
            </div>
          </div>

          {/* Bogotá Map */}
          <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card overflow-hidden relative min-h-[280px]">
            <BogotaMap className="h-full w-full" />
            {/* Overlay controls */}
            <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5">
              <div className="rounded-md bg-void/80 backdrop-blur-sm border border-border/30 px-2.5 py-1.5 text-[10px] text-ink-muted flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Filtros
              </div>
            </div>
            <div className="absolute top-3 right-14 z-[400] flex items-center gap-1">
              <div className="rounded-md bg-void/80 backdrop-blur-sm border border-border/30 px-2.5 py-1.5 text-[10px] text-ink-muted font-medium">
                Bogotá, Colombia
              </div>
            </div>
          </div>
        </div>

        {/* Leads table */}
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <h3 className="font-display text-sm font-bold text-ink">
              Leads extraídos <span className="text-ink-muted font-normal">(1,250)</span>
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-input px-3 py-1.5">
                <Search size={13} className="text-ink-dim" />
                <input
                  type="text"
                  placeholder="Buscar negocio..."
                  className="bg-transparent text-[12px] text-ink placeholder:text-ink-dim outline-none w-40"
                />
              </div>
              <button className="rounded-lg border border-border/50 bg-input px-3 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors">
                Filtros
              </button>
              <button className="rounded-lg border border-border/50 bg-input px-3 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors">
                Columnas
              </button>
            </div>
          </div>

          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-border/30 text-[10px] uppercase tracking-wider text-ink-dim">
                <th className="px-5 py-3 font-medium w-8">
                  <input type="checkbox" className="rounded border-border accent-accent" />
                </th>
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Sitio Web</th>
                <th className="px-4 py-3 font-medium">Calificación</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_LEADS.map((lead, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-card-hover transition-colors cursor-pointer">
                  <td className="px-5 py-3">
                    <input type="checkbox" className="rounded border-border accent-accent" />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{lead.name}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{lead.category}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 font-mono text-ink-muted">
                      <Phone size={11} /> {lead.phone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-accent">{lead.email}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-accent">
                      <Globe size={11} /> {lead.website}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Star size={12} className="text-amber fill-amber" />
                      <span className="text-ink font-medium">{lead.rating}</span>
                      <span className="text-ink-dim">({lead.reviews})</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-dim">{lead.address}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/30">
            <span className="text-[11px] text-ink-dim">Mostrando 1 a 7 de 1,250 resultados</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, "...", 179].map((page, i) => (
                <button
                  key={i}
                  className={`h-7 min-w-[28px] rounded-md px-2 text-[11px] font-medium transition-colors ${
                    page === 1
                      ? "bg-accent text-white"
                      : "text-ink-muted hover:bg-card-hover border border-border/30"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Area chart */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-ink">Negocios extraídos</h3>
              <span className="text-[10px] text-ink-dim border border-border/30 rounded px-2 py-0.5">Diario</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={AREA_DATA}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#825aff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#825aff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,54,0.8)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#828aa4" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#828aa4" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#10121e",
                    border: "1px solid rgba(30,34,54,0.8)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#825aff" fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-ink">Negocios por categoría</h3>
            </div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={PIE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {PIE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {PIE_DATA.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                    <span className="text-[11px] text-ink-muted">{item.name}</span>
                    <span className="text-[11px] text-ink font-medium ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar chart */}
          <div className="rounded-xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-bold text-ink">Leads por fuente</h3>
              <span className="text-[10px] text-ink-dim border border-border/30 rounded px-2 py-0.5">Este mes</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={BAR_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,34,54,0.8)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#828aa4" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: "#828aa4" }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#10121e",
                    border: "1px solid rgba(30,34,54,0.8)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {BAR_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
