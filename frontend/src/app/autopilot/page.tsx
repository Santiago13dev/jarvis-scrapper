"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Check, ChevronDown, Clock, Loader2, MapPin, Play, Plus, Sparkles, Target, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Flag } from "@/components/ui/flag";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { AutopilotRule, AutopilotSearchProgress, Country } from "@/types/api";

const KEYWORD_SUGGESTIONS: Record<string, string[]> = {
  es: ["restaurantes", "clínicas dentales", "gimnasios", "inmobiliarias", "tiendas de ropa", "abogados", "spa", "veterinarias", "talleres mecánicos", "centros de estética"],
  en: ["restaurants", "dentists", "gyms", "real estate agencies", "clothing stores", "law firms", "med spas", "veterinarians", "auto repair", "hair salons"],
};

const FREQUENCIES = [
  { hours: 24, label: "Todos los días" },
  { hours: 72, label: "Cada 3 días" },
  { hours: 168, label: "Cada semana" },
];

const DEPTHS = [
  { value: 1, label: "Rápida", hint: "3–10 min por búsqueda" },
  { value: 2, label: "Normal", hint: "8–15 min por búsqueda" },
  { value: 3, label: "Profunda", hint: "15–25 min, más resultados" },
];

function ChipInput({ values, onChange, suggestions, placeholder, icon }: { values: string[]; onChange: (values: string[]) => void; suggestions: string[]; placeholder: string; icon: React.ReactNode }) {
  const [draft, setDraft] = useState("");
  function add(value: string) {
    const clean = value.trim();
    if (clean && !values.includes(clean) && values.length < 10) onChange([...values, clean]);
    setDraft("");
  }
  return (
    <div>
      <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-border bg-input px-3 py-2 focus-within:border-border-light">
        {icon}
        {values.map((value) => (
          <span key={value} className="flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 text-[12.5px] text-ink">
            {value}
            <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Quitar ${value}`}><X size={12} /></button>
          </span>
        ))}
        <input
          value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={values.length ? "" : placeholder}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draft); } }}
          onBlur={() => add(draft)}
          className="min-w-[140px] flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-dim"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.filter((item) => !values.includes(item)).slice(0, 10).map((item) => (
          <button key={item} type="button" onClick={() => add(item)} className="rounded-md px-2 py-1 text-[12px] text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
            + {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return minutes ? `${minutes} min ${String(rest).padStart(2, "0")} s` : `${rest} s`;
}

/** Segundos transcurridos desde una fecha ISO, actualizado cada segundo. */
function useElapsed(since: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  return since ? Math.max(0, Math.round((now - new Date(since).getTime()) / 1000)) : 0;
}

function SearchRow({ item, active }: { item: AutopilotSearchProgress; active: boolean }) {
  const elapsed = useElapsed(active ? item.started_at : null);
  const duration = item.started_at && item.finished_at
    ? Math.round((new Date(item.finished_at).getTime() - new Date(item.started_at).getTime()) / 1000)
    : null;
  return (
    <li className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]", active && "bg-white/[0.04]")}>
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        item.status === "done" ? "bg-accent text-accent-ink" : item.status === "failed" ? "bg-red/15 text-red" : item.status === "running" ? "text-violet" : "border border-border-light")}>
        {item.status === "done" ? <Check size={12} strokeWidth={3} /> : item.status === "failed" ? <X size={12} strokeWidth={3} /> : item.status === "running" ? <Loader2 size={14} className="animate-spin" /> : null}
      </span>
      <span className={cn("min-w-0 flex-1 truncate", item.status === "pending" ? "text-ink-dim" : "text-ink")}>
        <span className="capitalize">{item.keyword}</span> <span className="text-ink-dim">· {item.location}</span>
      </span>
      <span className="shrink-0 text-right text-[12px] tabular-nums text-ink-dim">
        {item.status === "running" && `buscando · ${formatDuration(elapsed)}`}
        {item.status === "done" && (
          <>
            <span className="font-medium text-ink">{item.new} nuevos</span>
            {item.duplicates ? ` · ${item.duplicates} repetidos` : ""}
            {duration !== null ? ` · ${formatDuration(duration)}` : ""}
          </>
        )}
        {item.status === "failed" && <span className="text-red" title={item.error ?? undefined}>falló</span>}
        {item.status === "pending" && "en cola"}
      </span>
    </li>
  );
}

function RunProgress({ progress }: { progress: NonNullable<AutopilotRule["progress"]> }) {
  const total = progress.searches.length;
  const finished = progress.searches.filter((item) => item.status === "done" || item.status === "failed").length;
  const elapsed = useElapsed(progress.started_at);
  const enriching = progress.stage === "enriching";
  // La auditoría y redacción cuentan como un paso más al final
  const percent = Math.round(((finished + (enriching ? 0.5 : 0)) / (total + 1)) * 100);
  const current = progress.searches[progress.current];
  return (
    <div className="mt-5 rounded-xl border border-violet/30 bg-violet/[0.06] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-ink">
          {enriching ? "Revisando webs y escribiendo mensajes" : `Búsqueda ${Math.min(progress.current + 1, total)} de ${total}`}
          {!enriching && current && <span className="font-normal text-ink-muted"> · <span className="capitalize">{current.keyword}</span> en {current.location}</span>}
        </p>
        <span className="shrink-0 text-[12px] tabular-nums text-ink-dim">{formatDuration(elapsed)}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-violet transition-all duration-700" style={{ width: `${Math.max(4, percent)}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] text-ink-muted">
        <span className="font-semibold text-ink">{progress.new_leads}</span> negocios nuevos hasta ahora · {finished} de {total} búsquedas listas
        {enriching && " · auditando y puntuando"}
      </p>
      <ol className="mt-3 space-y-0.5">
        {progress.searches.map((item, index) => <SearchRow key={`${item.keyword}-${item.location}`} item={item} active={index === progress.current && !enriching} />)}
      </ol>
      <p className="mt-3 text-[11.5px] text-ink-dim">Cada búsqueda tarda de 5 a 15 minutos (hasta 25 en ciudades grandes) porque Jarvis abre la ficha y la web de cada negocio para sacar su correo. Si el computador se suspende, la búsqueda se pausa.</p>
    </div>
  );
}

function RuleCard({ rule, onToggle, onRun, onDelete }: { rule: AutopilotRule; onToggle: () => void; onRun: () => void; onDelete: () => void }) {
  const result = rule.last_result;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const lastDuration = result?.started_at && result.finished_at
    ? Math.round((new Date(result.finished_at).getTime() - new Date(result.started_at).getTime()) / 1000)
    : null;
  return (
    <article className={cn("flex flex-col rounded-2xl border bg-card p-6 transition-colors", rule.is_running ? "border-violet/50 md:col-span-2" : "border-border", !rule.is_active && !rule.is_running && "opacity-60")}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate text-[15px] font-semibold text-ink">
            <Flag code={rule.country} /> {rule.name}
          </h3>
          <p className="mt-1 text-[12.5px] text-ink-dim">
            {rule.keywords.length * rule.locations.length} {rule.keywords.length * rule.locations.length === 1 ? "búsqueda" : "búsquedas"} · {FREQUENCIES.find((f) => f.hours === rule.frequency_hours)?.label.toLowerCase() ?? `cada ${rule.frequency_hours} h`} · mensajes desde {rule.min_score} pts
          </p>
        </div>
        <button
          onClick={onToggle} role="switch" aria-checked={rule.is_active} aria-label={rule.is_active ? "Pausar" : "Activar"}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", rule.is_active ? "bg-accent" : "bg-border-light")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-void shadow transition-all", rule.is_active ? "left-[22px]" : "left-0.5")} />
        </button>
      </header>

      {rule.is_running && rule.progress ? (
        <RunProgress progress={rule.progress} />
      ) : (
        <div className="mt-5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {rule.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-white/[0.06] px-2 py-1 text-[12px] text-ink">{keyword}</span>)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rule.locations.map((location) => <span key={location} className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1 text-[12px] text-ink-muted"><MapPin size={11} />{location}</span>)}
          </div>
        </div>
      )}

      {rule.is_running && !rule.progress && (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-violet/30 bg-violet/[0.06] p-4 text-[13px] text-ink-muted">
          <Loader2 size={15} className="animate-spin text-violet" /> Buscando clientes… el detalle del avance aparecerá en la próxima ejecución.
        </p>
      )}

      <div className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-5">
        <div>
          <p className="font-display text-[22px] font-semibold leading-none text-ink">{rule.total_leads_found}</p>
          <p className="mt-1.5 text-[12px] text-ink-dim">leads en total</p>
        </div>
        <div>
          <p className="font-display text-[22px] font-semibold leading-none text-ink">{result?.new_leads ?? 0}</p>
          <p className="mt-1.5 text-[12px] text-ink-dim">nuevos última vez</p>
        </div>
        <div>
          <p className="font-display text-[22px] font-semibold leading-none text-ink">{result?.drafted ?? 0}</p>
          <p className="mt-1.5 text-[12px] text-ink-dim">mensajes listos</p>
        </div>
      </div>

      {result && !rule.is_running && (
        <div className="mt-4 text-[12.5px] text-ink-dim">
          <button onClick={() => setShowBreakdown(!showBreakdown)} className="flex items-center gap-1 hover:text-ink">
            Última ejecución: {new Date(result.finished_at).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {lastDuration !== null && ` · ${formatDuration(lastDuration)}`}
            {!!result.errors?.length && <span className="text-red"> · {result.errors.length} con error</span>}
            {result.breakdown && <ChevronDown size={13} className={cn("transition-transform", showBreakdown && "rotate-180")} />}
          </button>
          {showBreakdown && result.breakdown && (
            <ol className="mt-2 space-y-0.5">
              {result.breakdown.map((item) => <SearchRow key={`${item.keyword}-${item.location}`} item={item} active={false} />)}
            </ol>
          )}
        </div>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          {rule.is_running ? (
            <><Loader2 size={12} className="animate-spin text-violet" /> En curso</>
          ) : rule.is_active && rule.next_run_at ? (
            <><Clock size={12} className="shrink-0 text-violet" /> Próxima: {new Date(rule.next_run_at).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>
          ) : (
            "En pausa"
          )}
        </span>
        <div className="flex gap-1.5">
          <button onClick={onDelete} disabled={rule.is_running} title={rule.is_running ? "No se puede eliminar mientras busca" : "Eliminar"} className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-white/[0.05] hover:text-red disabled:opacity-30"><Trash2 size={15} /></button>
          <button onClick={onRun} disabled={rule.is_running} className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-border-light hover:bg-white/[0.03] disabled:opacity-40">
            <Play size={13} /> Ejecutar ahora
          </button>
        </div>
      </footer>
    </article>
  );
}

export default function AutopilotPage() {
  const { workspaceId } = useActiveWorkspace();
  const [rules, setRules] = useState<AutopilotRule[] | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ country: "CO", keywords: [] as string[], locations: [] as string[], frequency_hours: 24, depth: 2, min_score: 70 });

  const base = workspaceId ? `/workspaces/${workspaceId}/automation` : null;
  const load = useCallback(async () => {
    if (!base) return;
    try { setRules(await api.get<AutopilotRule[]>(`${base}/autopilot/rules`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al cargar"); }
  }, [base]);

  useEffect(() => {
    if (!base) return;
    load();
    api.get<Country[]>(`${base}/countries`).then(setCountries).catch(() => undefined);
  }, [base, load]);

  // Mientras alguna regla busca, se refresca cada 5 s para mostrar el avance en vivo
  const anyRunning = !!rules?.some((rule) => rule.is_running);
  useEffect(() => {
    if (!base) return;
    const timer = window.setInterval(load, anyRunning ? 5_000 : 15_000);
    return () => window.clearInterval(timer);
  }, [base, load, anyRunning]);

  useEffect(() => { if (rules && rules.length === 0) setCreating(true); }, [rules]);

  const country = countries.find((item) => item.code === form.country);
  const suggestions = KEYWORD_SUGGESTIONS[country?.language ?? "es"];
  const searches = form.keywords.length * form.locations.length;
  const autoName = useMemo(() => {
    const what = form.keywords[0] ?? "Negocios";
    const where = form.locations[0] ?? country?.name ?? "";
    const more = searches > 1 ? " +" : "";
    return `${what.charAt(0).toUpperCase()}${what.slice(1)} en ${where}${more}`;
  }, [form.keywords, form.locations, country, searches]);

  async function create() {
    if (!base || searches === 0) return;
    setSaving(true); setError(null);
    try {
      await api.post(`${base}/autopilot/rules`, { ...form, name: autoName });
      setCreating(false);
      setForm({ ...form, keywords: [], locations: [] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function patch(rule: AutopilotRule, body: Partial<AutopilotRule>) {
    if (!base) return;
    await api.patch(`${base}/autopilot/rules/${rule.id}`, body);
    await load();
  }

  async function run(rule: AutopilotRule) {
    if (!base) return;
    try {
      await api.post(`${base}/autopilot/rules/${rule.id}/run`);
      setRules((prev) => prev?.map((item) => (item.id === rule.id ? { ...item, is_running: true } : item)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar");
    }
  }

  async function remove(rule: AutopilotRule) {
    if (!base || !window.confirm(`¿Eliminar "${rule.name}"? Los leads que ya encontró se conservan.`)) return;
    await api.delete(`${base}/autopilot/rules/${rule.id}`);
    await load();
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink">Jarvis busca clientes por ti, solo</h2>
          <p className="mt-1 text-[13.5px] text-ink-muted">Busca en Google Maps, revisa sus webs, los puntúa y te deja el mensaje listo para aprobar.</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover">
            <Plus size={16} /> Nueva búsqueda automática
          </button>
        )}
      </section>

      {error && <div className="mt-6 rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-[13px] text-red">{error}</div>}

      {creating && (
        <section className="rise-in mt-6 rounded-2xl border border-border bg-card p-6 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <p className="mb-2.5 text-[13px] font-medium text-ink">1. ¿En qué país?</p>
                <div className="grid grid-cols-3 gap-2">
                  {(countries.length ? countries : [{ code: "CO", name: "Colombia" }, { code: "ES", name: "España" }, { code: "US", name: "Estados Unidos" }]).map((item) => (
                    <button
                      key={item.code} type="button" onClick={() => setForm({ ...form, country: item.code, keywords: [], locations: [] })}
                      className={cn("rounded-xl border p-3 text-center transition-all", form.country === item.code ? "border-border-light bg-white/[0.06]" : "border-border hover:border-border-light")}
                    >
                      <Flag code={item.code} className="mx-auto mb-1.5 block text-[22px]" />
                      <span className="text-[12.5px] text-ink-muted">{item.name}</span>
                    </button>
                  ))}
                </div>
                {country && !country.show_prices && <p className="mt-2 text-[12px] text-ink-dim">En {country.name} Jarvis recomienda el servicio sin mostrar precios en COP{country.language === "en" ? " y escribe los mensajes en inglés" : ""}.</p>}
              </div>
              <div>
                <p className="mb-2.5 text-[13px] font-medium text-ink">2. ¿Qué tipo de negocios?</p>
                <ChipInput values={form.keywords} onChange={(keywords) => setForm({ ...form, keywords })} suggestions={suggestions} placeholder="Escribe un rubro y pulsa Enter" icon={<Target size={14} className="text-ink-dim" />} />
              </div>
              <div>
                <p className="mb-2.5 text-[13px] font-medium text-ink">3. ¿En qué ciudades?</p>
                <ChipInput values={form.locations} onChange={(locations) => setForm({ ...form, locations })} suggestions={country?.cities ?? []} placeholder="Escribe una ciudad y pulsa Enter" icon={<MapPin size={14} className="text-ink-dim" />} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2.5 text-[13px] font-medium text-ink">4. ¿Cada cuánto?</p>
                <div className="grid grid-cols-3 gap-2">
                  {FREQUENCIES.map((item) => (
                    <button key={item.hours} type="button" onClick={() => setForm({ ...form, frequency_hours: item.hours })}
                      className={cn("rounded-xl border px-3 py-2.5 text-[13px] transition-colors", form.frequency_hours === item.hours ? "border-border-light bg-white/[0.06] text-ink" : "border-border text-ink-muted hover:border-border-light hover:text-ink")}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2.5 text-[13px] font-medium text-ink">Profundidad</p>
                <div className="grid grid-cols-3 gap-2">
                  {DEPTHS.map((item) => (
                    <button key={item.value} type="button" onClick={() => setForm({ ...form, depth: item.value })} title={item.hint}
                      className={cn("rounded-xl border px-3 py-2.5 text-left transition-all", form.depth === item.value ? "border-border-light bg-white/[0.06]" : "border-border hover:border-border-light")}>
                      <span className={cn("block text-[12px] font-semibold", "text-ink")}>{item.label}</span>
                      <span className="text-[11.5px] text-ink-dim">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="min-score" className="mb-2.5 flex justify-between text-[13px] font-medium text-ink">
                  Escribir mensaje solo a leads con puntaje desde <span className="tabular-nums text-ink">{form.min_score} pts</span>
                </label>
                <input id="min-score" type="range" min={40} max={95} step={5} value={form.min_score} onChange={(event) => setForm({ ...form, min_score: Number(event.target.value) })} className="w-full accent-[#39ff88]" />
                <p className="mt-1 text-[12px] text-ink-dim">Más alto = menos mensajes, pero de mejor calidad.</p>
              </div>

              <div className="rounded-xl bg-input p-5">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Sparkles size={15} className="text-accent" /> {autoName}</p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {searches === 0
                    ? "Agrega al menos un rubro y una ciudad."
                    : `Jarvis hará ${searches} ${searches === 1 ? "búsqueda" : "búsquedas"} ${FREQUENCIES.find((f) => f.hours === form.frequency_hours)?.label.toLowerCase()}. La primera empieza en menos de 10 minutos.`}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={create} disabled={saving || searches === 0} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-white/[0.06] disabled:text-ink-dim">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Bot size={15} />} Activar piloto automático
                  </button>
                  {!!rules?.length && <button onClick={() => setCreating(false)} className="rounded-lg border border-border px-4 text-[13px] text-ink-muted hover:border-border-light hover:text-ink">Cancelar</button>}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules === null
          ? [0, 1, 2].map((index) => <div key={index} className="h-64 animate-pulse rounded-2xl border border-border bg-card" />)
          : rules.map((rule) => (
              <RuleCard key={rule.id} rule={rule} onToggle={() => patch(rule, { is_active: !rule.is_active })} onRun={() => run(rule)} onDelete={() => remove(rule)} />
            ))}
      </div>
    </AppShell>
  );
}
