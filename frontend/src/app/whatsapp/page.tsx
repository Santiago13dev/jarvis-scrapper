"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

const OPENWA_URL = process.env.NEXT_PUBLIC_OPENWA_URL ?? "http://localhost:8090";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${OPENWA_URL}/session/main/status`);
        if (res.ok) { const data = await res.json(); setStatus(data.status === "WORKING" ? "connected" : "disconnected"); }
        else setStatus("disconnected");
      } catch { setStatus("disconnected"); }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">WhatsApp</h1>
          <p className="text-[12px] text-ink-muted mt-0.5">Escaneá el código QR para conectar tu cuenta</p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
              <iframe src={OPENWA_URL} className="h-[460px] w-full border-0 sm:h-[600px]" title="WhatsApp QR" />
            </div>
          </div>
          <div className="grid shrink-0 gap-4 sm:grid-cols-2 lg:block lg:w-72 lg:space-y-4">
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <h3 className="text-[13px] font-medium text-ink">Estado de conexión</h3>
              <div className="mt-3 flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-teal" : status === "loading" ? "bg-amber animate-pulse" : "bg-red"}`} />
                <span className="text-[13px] text-ink">{status === "connected" ? "Conectado" : status === "loading" ? "Verificando..." : "Desconectado"}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <h3 className="text-[13px] font-medium text-ink">Instrucciones</h3>
              <ol className="mt-3 space-y-2 text-[12px] text-ink-muted list-decimal list-inside">
                <li>Abrí WhatsApp en tu celular</li>
                <li>Presioná los tres puntos → <strong className="text-ink">Dispositivos vinculados</strong></li>
                <li>Escaneá el código QR</li>
                <li>Listo, tu cuenta está conectada</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
