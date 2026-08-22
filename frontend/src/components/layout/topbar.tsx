"use client";

import { Bell, ChevronDown, Calendar } from "lucide-react";

export function Topbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/30 bg-sidebar/50 px-8">
      {/* Left: Welcome */}
      <div>
        <h1 className="font-display text-xl font-bold text-ink flex items-center gap-2">
          ¡Bienvenido, Santiago! <span className="text-xl">👋</span>
        </h1>
        <p className="text-[12px] text-ink-muted mt-0.5">Aquí tienes el resumen de tu actividad</p>
      </div>

      {/* Right: Date + User */}
      <div className="flex items-center gap-4">
        {/* Date range */}
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-[12px] text-ink-muted">
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
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card pl-3 pr-2 py-1.5">
          <div className="text-right">
            <p className="text-[12px] font-medium text-ink leading-tight">Santiago R.</p>
            <p className="text-[10px] text-ink-dim">Plan Pro</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[11px] font-bold text-accent">
            SR
          </div>
        </div>
      </div>
    </header>
  );
}
