"use client";

import { Bell, ChevronDown, Calendar } from "lucide-react";

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

      {/* Right: Date + User */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        {/* Date range */}
        <div className="hidden items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-[12px] text-ink-muted xl:flex">
          <Calendar size={13} className="text-ink-dim" />
          <span>01 May 2024 — 31 May 2024</span>
          <ChevronDown size={12} className="text-ink-dim" />
        </div>

        {/* Notifications */}
        <button className="relative rounded-lg border border-border/50 bg-card p-2 text-ink-muted hover:text-ink transition-colors">
          <Bell size={16} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center">
            3
          </span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-1.5 sm:pl-3 sm:pr-2">
          <div className="text-right">
            <p className="hidden text-[12px] font-medium text-ink leading-tight sm:block">Santiago R.</p>
            <p className="hidden text-[10px] text-ink-dim sm:block">Plan Pro</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[11px] font-bold text-accent">
            SR
          </div>
        </div>
      </div>
    </header>
  );
}
