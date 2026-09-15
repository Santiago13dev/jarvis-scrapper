"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  MessageCircle,
  FileText,
  Settings,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const SECTIONS = [
  {
    label: "EXTRACCIÓN",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/leads", label: "Leads", icon: Users },
    ],
  },
  {
    label: "DATOS",
    items: [
      { href: "/templates", label: "Plantillas", icon: FileText },
    ],
  },
  {
    label: "CAMPAÑAS",
    items: [
      { href: "/campaigns", label: "Campañas", icon: Megaphone },
      { href: "/whatsapp", label: "WhatsApp", icon: Phone },
      { href: "/conversations", label: "Conversaciones", icon: MessageCircle },
    ],
  },
  {
    label: "AJUSTES",
    items: [
      { href: "/settings", label: "Configuración", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 flex h-[68px] border-t border-border/60 bg-sidebar/95 px-1 pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-t-0 lg:px-0 lg:pb-0">
      {/* Brand */}
      <div className="hidden items-center gap-3 border-b border-border/30 px-5 py-5 lg:flex">
        <Logo />
        <div>
          <span className="font-display text-[15px] font-bold tracking-tight text-ink block leading-tight">
            JarvisIA
          </span>
          <span className="text-[9px] text-ink-dim uppercase tracking-[0.2em]">
            JarvisIA
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 items-center justify-around gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:justify-start lg:gap-5 lg:px-3 lg:py-5 lg:overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label} className="contents lg:block">
            <p className="mb-2 hidden px-3 text-[9px] font-semibold text-ink-dim uppercase tracking-[0.2em] lg:block">
              {section.label}
            </p>
            <div className="contents lg:flex lg:flex-col lg:gap-0.5">
              {section.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex min-w-[58px] flex-col items-center gap-1 rounded-md px-2 py-2 text-[9px] font-medium transition-colors lg:flex-row lg:gap-3 lg:rounded-lg lg:px-3 lg:text-[13px]",
                      isActive
                        ? "bg-accent/15 text-accent border border-accent/20"
                        : "text-ink-muted hover:bg-white/5 hover:text-ink border border-transparent"
                    )}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={cn(
                        "transition-colors shrink-0",
                        isActive ? "text-accent" : "text-ink-dim group-hover:text-ink-muted"
                      )}
                    />
                    <span className="max-w-[64px] truncate lg:max-w-none">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usage bar */}
      <div className="hidden border-t border-border/30 px-5 py-4 space-y-3 lg:block">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-ink-dim uppercase tracking-wider">Uso actual</span>
            <span className="text-[10px] text-accent font-medium">78%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
            <div className="h-full rounded-full bg-accent" style={{ width: "78%" }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-dim">Leads este mes: <span className="text-ink font-mono">12,540</span> / 16,000</span>
        </div>
        <button className="w-full rounded-lg bg-accent/15 border border-accent/25 py-2 text-[12px] font-medium text-accent hover:bg-accent/25 transition-colors">
          Mejorar plan
        </button>
      </div>
    </aside>
  );
}
