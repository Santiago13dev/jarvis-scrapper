"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CheckCheck, Globe, Loader2, MapPin, PenLine, Search, Target, X } from "lucide-react";
import { Flag } from "@/components/ui/flag";
import { api } from "@/lib/api-client";
import { parseSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { Country } from "@/types/api";

const EXAMPLES: Record<string, string[]> = {
  CO: ["restaurantes en Medellín", "clínicas dentales en Bogotá", "gimnasios en Cali", "inmobiliarias en Barranquilla"],
  ES: ["clínicas dentales en Madrid", "restaurantes en Barcelona", "gimnasios en Valencia", "abogados en Sevilla"],
  US: ["dentists in Miami", "restaurants in Orlando", "med spas in Houston", "law firms in Dallas"],
};

const DEPTHS = [
  { value: 1, label: "Rápida", hint: "~20 negocios · 1–2 min" },
  { value: 2, label: "Normal", hint: "~40 negocios · 2–4 min" },
  { value: 3, label: "Profunda", hint: "60+ negocios · 4–8 min" },
];

const STEPS = [
  { icon: Search, label: "Buscando negocios en Google Maps" },
  { icon: Globe, label: "Revisando sus páginas web y redes" },
  { icon: Target, label: "Calculando la oportunidad de cada uno" },
  { icon: PenLine, label: "Escribiendo mensajes para los mejores" },
];

export interface SearchResult {
  imported_count: number;
  skipped_duplicates: number;
  skipped_closed: number;
}

/** Escribe ejemplos en el placeholder, uno tras otro. */
function useRotatingPlaceholder(items: string[]) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(0);
  useEffect(() => {
    const text = items[index % items.length];
    const timer = window.setTimeout(
      () => {
        if (length < text.length) setLength(length + 1);
        else { setLength(0); setIndex(index + 1); }
      },
      length < text.length ? 55 : 1800,
    );
    return () => window.clearTimeout(timer);
  }, [items, index, length]);
  return items[index % items.length].slice(0, length);
}

export function JarvisSearch({
  workspaceId,
  onDone,
  autoFocus = false,
  compact = false,
}: {
  workspaceId: string | null;
  onDone?: (result: SearchResult) => void;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState("CO");
  const [prompt, setPrompt] = useState("");
  const [depth, setDepth] = useState(2);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<Country[]>(`/workspaces/${workspaceId}/automation/countries`).then(setCountries).catch(() => undefined);
  }, [workspaceId]);

  const parsed = useMemo(() => parseSearch(prompt, countries), [prompt, countries]);
  const effectiveCountry = parsed.country ?? country;
  const placeholder = useRotatingPlaceholder(EXAMPLES[effectiveCountry] ?? EXAMPLES.CO);
  const ready = parsed.keyword.length > 1 && parsed.location.length > 1;

  // Pasos visuales mientras el backend busca (la petición dura varios minutos)
  useEffect(() => {
    if (phase !== "running") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000);
      setElapsed(seconds);
      setStep(seconds < 50 ? 0 : seconds < 100 ? 1 : seconds < 140 ? 2 : 3);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function run() {
    if (!workspaceId || !ready || phase === "running") return;
    setPhase("running"); setStep(0); setElapsed(0); setError(null); setResult(null);
    try {
      const response = await api.post<SearchResult>(`/workspaces/${workspaceId}/leads/import`, {
        keyword: parsed.keyword,
        location: parsed.location,
        country: effectiveCountry,
        depth,
        max_results: 500,
      });
      setResult(response);
      setPhase("done");
      onDone?.(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La búsqueda falló");
      setPhase("error");
    }
  }

  const countryName = countries.find((item) => item.code === effectiveCountry)?.name;

  return (
    <section className={cn("rounded-2xl border border-border bg-card", compact ? "p-5" : "p-6")}>
      {phase === "running" ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-ink">
              Buscando {parsed.keyword} en {parsed.location} <Flag code={effectiveCountry} className="ml-1" />
            </p>
            <span className="font-mono text-[12px] text-ink-dim">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${Math.min(95, 8 + elapsed / 2)}%` }} />
          </div>
          <ol className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {STEPS.map(({ icon: Icon, label }, index) => (
              <li key={label} className={cn("flex items-center gap-3 text-[13px] transition-colors duration-500", index <= step ? "text-ink" : "text-ink-dim")}>
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", index < step ? "bg-accent text-accent-ink" : index === step ? "bg-white/[0.08] text-accent" : "bg-white/[0.04]")}>
                  {index < step ? <Check size={13} strokeWidth={3} /> : index === step ? <Loader2 size={13} className="animate-spin" /> : <Icon size={12} />}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[12px] text-ink-dim">Puedes seguir usando Jarvis: la búsqueda continúa en el servidor aunque cambies de pantalla.</p>
        </div>
      ) : phase === "done" && result ? (
        <div className="rise-in flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-ink"><Check size={20} strokeWidth={3} /></span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{result.imported_count} negocios nuevos</p>
              <p className="text-[12.5px] text-ink-dim">
                {result.skipped_duplicates} ya los tenías · {result.skipped_closed} cerrados descartados · Jarvis está puntuando y escribiendo mensajes.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => { setPhase("idle"); setPrompt(""); }} className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-light hover:text-ink">Otra búsqueda</button>
            <Link href="/approvals" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink hover:bg-accent-hover"><CheckCheck size={15} /> Ver mensajes</Link>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-ink">¿A quién le vendemos hoy?</p>
              <p className="text-[12.5px] text-ink-dim">Escribe el tipo de negocio y la ciudad. Jarvis hace el resto.</p>
            </div>
            <div className="flex rounded-lg bg-input p-0.5" role="tablist" aria-label="País">
              {(countries.length ? countries : [{ code: "CO", name: "Colombia" } as Country]).map((item) => (
                <button key={item.code} role="tab" aria-selected={effectiveCountry === item.code} onClick={() => setCountry(item.code)}
                  className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                    effectiveCountry === item.code ? "bg-card-hover text-ink shadow-sm" : "text-ink-dim hover:text-ink")}>
                  <Flag code={item.code} /> <span className="hidden sm:inline">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); run(); }} className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Qué negocios y dónde</span>
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-dim" />
              <input
                value={prompt} onChange={(event) => setPrompt(event.target.value)} autoFocus={autoFocus}
                placeholder={`Ej: ${placeholder}`}
                className="w-full rounded-xl border border-border bg-input py-3.5 pl-11 pr-10 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-border-light focus:bg-void"
              />
              {prompt && <button type="button" onClick={() => setPrompt("")} aria-label="Borrar" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-dim hover:text-ink"><X size={15} /></button>}
            </label>
            <button type="submit" disabled={!ready}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-[14px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-white/[0.06] disabled:text-ink-dim">
              Buscar <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-3 flex min-h-[28px] flex-wrap items-center gap-2 text-[12px]">
            {prompt ? (
              <>
                <span className="text-ink-dim">Entendí:</span>
                <span className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 text-ink"><Target size={12} className="text-ink-dim" /> {parsed.keyword || "¿qué negocios?"}</span>
                <span className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", parsed.location ? "bg-white/[0.05] text-ink" : "bg-amber/10 text-amber")}>
                  <MapPin size={12} className={parsed.location ? "text-ink-dim" : ""} /> {parsed.location || "falta la ciudad: escribe \u201c\u2026 en Ciudad\u201d"}
                </span>
                <span className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 text-ink"><Flag code={effectiveCountry} /> {countryName}</span>
              </>
            ) : (
              <>
                <span className="text-ink-dim">Prueba:</span>
                {(EXAMPLES[effectiveCountry] ?? []).map((example) => (
                  <button key={example} type="button" onClick={() => setPrompt(example)} className="rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
                    {example}
                  </button>
                ))}
              </>
            )}
            <span className="ml-auto flex items-center gap-1">
              <span className="mr-1 text-ink-dim">Profundidad</span>
              {DEPTHS.map((item) => (
                <button key={item.value} type="button" title={item.hint} onClick={() => setDepth(item.value)}
                  className={cn("rounded-md px-2 py-1 transition-colors", depth === item.value ? "bg-white/[0.08] font-medium text-ink" : "text-ink-dim hover:text-ink")}>
                  {item.label}
                </button>
              ))}
            </span>
          </div>
          {phase === "error" && error && <p className="mt-3 rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-[12px] text-red">{error}</p>}
        </div>
      )}
    </section>
  );
}
