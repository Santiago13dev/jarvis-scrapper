"use client";

import { Building2 } from "lucide-react";

export function Topbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="flex min-h-[64px] shrink-0 items-center justify-between gap-3 border-b border-border/30 bg-sidebar/50 px-4 py-3 sm:px-6 lg:h-[72px] lg:px-8">
      {/* Left: Welcome */}
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 truncate font-display text-base font-bold text-ink sm:text-xl">
          Bienvenido a Jarvis
        </h1>
        <p className="mt-0.5 hidden text-[12px] text-ink-muted sm:block">Aquí tienes el resumen de tu actividad</p>
      </div>

      {/* Right: active workspace */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-[12px] text-ink-muted">
          <Building2 size={15} className="text-accent" />
          <span className="max-w-[180px] truncate">{workspaceName}</span>
        </div>
      </div>
    </header>
  );
}
