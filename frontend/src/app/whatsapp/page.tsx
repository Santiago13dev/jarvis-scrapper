"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCheck, Clock, Loader2, LogOut, MessageCircle, MoreVertical, QrCode, RefreshCw, Send, ShieldCheck, Smartphone, Unplug } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { DashboardOverview } from "@/types/api";

const OPENWA_URL = process.env.NEXT_PUBLIC_OPENWA_URL ?? "http://localhost:8090";

type WaState = "loading" | "starting" | "qr" | "connected" | "error";
interface WaInfo { status: string; phone: string | null; name: string | null }

function toState(status: string | undefined): WaState {
  if (status === "WORKING") return "connected";
  if (status === "QR_READY") return "qr";
  if (status === "ERROR" || status === "DISCONNECTED") return "error";
  return "starting";
}

const STEPS = [
  { icon: Smartphone, text: "Abre WhatsApp en tu celular" },
  { icon: MoreVertical, text: "Toca ⋮ (Android) o Configuración (iPhone)" },
  { icon: QrCode, text: "Entra a Dispositivos vinculados → Vincular un dispositivo" },
  { icon: CheckCheck, text: "Apunta la cámara a este código" },
];

export default function WhatsAppPage() {
  const { workspaceId } = useActiveWorkspace();
  const [state, setState] = useState<WaState>("loading");
  const [info, setInfo] = useState<WaInfo | null>(null);
  const [qrVersion, setQrVersion] = useState(0);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<{ whatsapp_provider: string }>(`/workspaces/${workspaceId}/settings`).then((data) => setProvider(data.whatsapp_provider)).catch(() => setProvider("openwa"));
  }, [workspaceId]);

  const check = useCallback(async () => {
    try {
      const response = await fetch(`${OPENWA_URL}/me`, { cache: "no-store" });
      const data: WaInfo = await response.json();
      setInfo(data);
      setState(toState(data.status));
    } catch {
      setState("error");
    }
  }, []);

  // Mientras no esté conectado se consulta seguido: así detecta el escaneo al instante
  useEffect(() => {
    check();
    const timer = window.setInterval(check, state === "connected" ? 20_000 : 3_000);
    return () => window.clearInterval(timer);
  }, [check, state]);

  // El código QR de WhatsApp caduca: se refresca la imagen cada 20 s
  useEffect(() => {
    if (state !== "qr") return;
    const timer = window.setInterval(() => setQrVersion((value) => value + 1), 20_000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (!workspaceId) return;
    api.get<DashboardOverview>(`/workspaces/${workspaceId}/dashboard/overview`).then(setOverview).catch(() => undefined);
  }, [workspaceId, state]);

  async function sendTest() {
    const digits = testPhone.replace(/\D/g, "");
    if (digits.length < 8) return;
    setTestState("sending"); setTestError(null);
    try {
      const response = await fetch(`${OPENWA_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, message: "✅ Hola, soy Jarvis. Tu WhatsApp está conectado y listo para conseguir clientes." }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "No se pudo enviar");
      setTestState("sent");
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "No se pudo enviar");
      setTestState("error");
    }
  }

  async function logout() {
    if (!window.confirm("¿Desconectar este número de Jarvis? Los mensajes programados no saldrán hasta que vuelvas a conectar.")) return;
    setLoggingOut(true);
    try { await fetch(`${OPENWA_URL}/logout`, { method: "POST" }); } finally {
      setLoggingOut(false);
      setState("starting");
    }
  }

  const sentToday = overview?.sent_today ?? 0;
  const limit = overview?.daily_send_limit ?? 40;

  if (provider && provider !== "openwa") {
    const assisted = provider === "assisted";
    return (
      <AppShell>
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-wa/15 blur-3xl" />
          <div className="relative max-w-2xl">
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-wa"><span className="h-1.5 w-1.5 rounded-full bg-wa" /> {assisted ? "Modo asistido" : "API oficial de WhatsApp (Meta)"}</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold tracking-tight text-ink">
              {assisted ? "Envías desde tu propio WhatsApp, con un toque" : "Envíos automáticos con la API oficial"}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
              {assisted
                ? "Jarvis prepara la lista y el mensaje de cada negocio; tú lo envías desde tu WhatsApp y Jarvis registra el contacto y el seguimiento. No necesitas escanear ningún código QR y no hay riesgo de bloqueo por automatización."
                : "Los mensajes aprobados salen solos desde tu número verificado en Meta, con plantillas aprobadas para el primer contacto."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={assisted ? "/outreach" : "/approvals"} className="rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-ink">
                {assisted ? "Ir a Contactar hoy" : "Ir a Aprobar mensajes"}
              </Link>
              <Link href="/approvals" className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-ink-muted hover:border-border-light hover:text-ink">Mensajes escritos por Jarvis</Link>
            </div>
            <p className="mt-6 text-[12.5px] text-ink-dim">
              El modo se define en el servidor con la variable <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink">WHATSAPP_PROVIDER</code> (assisted, openwa o cloud_api). Consulta el README.
            </p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {state === "connected" ? (
        <div className="space-y-5">
          {/* Conectado */}
          <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-wa/15 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-wa text-accent-ink shadow-[0_0_32px_rgb(var(--wa)/0.45)]">
                <MessageCircle size={30} strokeWidth={2.2} />
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-card bg-accent"><CheckCheck size={13} className="text-accent-ink" /></span>
              </div>
              <div className="flex-1">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-wa"><span className="h-1.5 w-1.5 rounded-full bg-wa" /> Conectado</p>
                <h2 className="mt-1 font-display text-[22px] font-semibold tracking-tight text-ink">{info?.name ?? "Tu WhatsApp"}</h2>
                <p className="text-[14px] tabular-nums text-ink-muted">{info?.phone ? `+${info.phone}` : "Número vinculado"}</p>
              </div>
              <button onClick={logout} disabled={loggingOut} className="relative flex items-center gap-2 self-start rounded-lg border border-border px-4 py-2.5 text-[13px] text-ink-muted transition-colors hover:border-red/40 hover:text-red sm:self-center">
                {loggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Desconectar
              </button>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-4 text-[15px] font-semibold text-ink">Uso de hoy</h3>
              <div className="flex items-end justify-between">
                <span className="font-display text-[36px] font-semibold leading-none text-ink">{sentToday}</span>
                <span className="text-[12px] text-ink-dim">de {limit} permitidos</span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${Math.min(100, (sentToday / Math.max(1, limit)) * 100)}%` }} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-muted"><Clock size={13} className="text-violet" /> {overview?.scheduled_messages ?? 0} mensajes programados</p>
              <Link href="/settings" className="mt-3 inline-block text-[12.5px] font-medium text-ink-muted hover:text-ink">Cambiar el límite diario</Link>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-1 text-[15px] font-semibold text-ink">Mensaje de prueba</h3>
              <p className="mb-3 text-[12px] text-ink-muted">Envíate un mensaje a tu propio celular para confirmar que todo funciona.</p>
              <form onSubmit={(event) => { event.preventDefault(); sendTest(); }} className="flex gap-2">
                <input value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="573001234567" inputMode="tel"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2.5 text-[13px] tabular-nums text-ink outline-none focus:border-border-light" />
                <button type="submit" disabled={testState === "sending"} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-ink disabled:opacity-50">
                  {testState === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
                </button>
              </form>
              <p className="mt-2 text-[11px] text-ink-dim">Con indicativo de país, sin +. Ej: 57 para Colombia, 34 España, 1 EE. UU.</p>
              {testState === "sent" && <p className="mt-2 text-[12.5px] font-medium text-accent">✅ Enviado. Revisa tu WhatsApp.</p>}
              {testState === "error" && <p className="mt-2 text-[12px] text-red">{testError}</p>}
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink"><ShieldCheck size={16} className="text-accent" /> Así protegemos tu número</h3>
              <ul className="space-y-2 text-[12px] text-ink-muted">
                <li>• Solo salen los mensajes que tú apruebas.</li>
                <li>• Máximo {limit} por día, con 1–2,5 min entre cada uno.</li>
                <li>• Solo en horario laboral del país del cliente.</li>
                <li>• Quien responde &quot;NO&quot; o &quot;STOP&quot; no vuelve a recibir mensajes.</li>
                <li>• Tus chats personales nunca se procesan ni se responden.</li>
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
          {/* Conectar con QR */}
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="text-[12.5px] font-medium text-wa">Paso a paso</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold tracking-tight text-ink">Conecta tu WhatsApp en 30 segundos</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Así Jarvis puede enviar los mensajes que apruebes desde tu número.</p>
            <ol className="mt-6 space-y-3">
              {STEPS.map(({ icon: Icon, text }, index) => (
                <li key={text} className="flex items-center gap-4 rounded-xl bg-input px-4 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wa/15 text-[13px] font-semibold text-wa">{index + 1}</span>
                  <span className="text-[13px] text-ink">{text}</span>
                  <Icon size={18} className="ml-auto shrink-0 text-ink-dim" />
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-center gap-2 text-[12px] text-ink-dim"><ShieldCheck size={14} className="text-accent" /> Jarvis nunca lee ni responde tus chats personales.</p>
          </section>

          <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 text-center">
            {state === "qr" ? (
              <>
                <div className="relative rounded-3xl bg-white p-4 shadow-[0_0_50px_rgb(var(--wa)/0.25)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${OPENWA_URL}/qr?v=${qrVersion}`} alt="Código QR para vincular WhatsApp" width={280} height={280} className="h-[280px] w-[280px]" />
                  <span className="pointer-events-none absolute inset-x-4 top-4 h-0.5 animate-[scan_2.4s_ease-in-out_infinite] bg-wa shadow-[0_0_12px_rgb(var(--wa))]" />
                  {["left-2 top-2 border-l-4 border-t-4", "right-2 top-2 border-r-4 border-t-4", "bottom-2 left-2 border-b-4 border-l-4", "bottom-2 right-2 border-b-4 border-r-4"].map((corner) => (
                    <span key={corner} className={cn("pointer-events-none absolute h-8 w-8 rounded-sm border-wa", corner)} />
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-2 text-[13px] font-semibold text-ink"><Loader2 size={14} className="animate-spin text-wa" /> Esperando que escanees…</p>
                <p className="mt-1 text-[11px] text-ink-dim">El código se renueva solo cada 20 segundos.</p>
              </>
            ) : state === "error" ? (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red/10 text-red"><Unplug size={30} /></span>
                <p className="mt-4 font-display text-lg font-bold text-ink">El servicio de WhatsApp no responde</p>
                <p className="mt-1 max-w-xs text-[12px] text-ink-muted">Se está reiniciando o el contenedor está apagado. Reintentamos automáticamente.</p>
                <button onClick={check} className="mt-4 flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-ink hover:border-border-light"><RefreshCw size={14} /> Reintentar ahora</button>
              </>
            ) : (
              <>
                <Loader2 size={40} className="animate-spin text-wa" />
                <p className="mt-4 font-display text-lg font-bold text-ink">Preparando el código QR…</p>
                <p className="mt-1 text-[12px] text-ink-muted">Tarda unos segundos la primera vez.</p>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
