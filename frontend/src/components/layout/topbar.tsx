"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Send } from "lucide-react";
import { Logo } from "./logo";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
}

export function Topbar({ workspaceName }: { workspaceName: string }) {
  // Se calcula en el navegador para usar la hora local (el servidor corre en UTC).
  const [now, setNow] = useState<{ hello: string; today: string } | null>(null);
  useEffect(() => {
    setNow({ hello: greeting(), today: new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) });
  }, []);

  return (
    <header className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b border-border/30 bg-sidebar/50 px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <span className="lg:hidden"><Logo /></span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{now?.hello ?? "Hola"}</p>
          <p className="truncate text-[12px] first-letter:uppercase text-ink-muted">{now?.today ?? " "}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/outreach"
          className="hidden items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white hover:bg-accent-hover sm:inline-flex"
        >
          <Send size={14} /> Contactar hoy
        </Link>
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-[12px] text-ink-muted" title="Espacio de trabajo activo">
          <Building2 size={15} className="text-accent" />
          <span className="max-w-[120px] truncate sm:max-w-[180px]">{workspaceName}</span>
        </div>
      </div>
    </header>
  );
}
