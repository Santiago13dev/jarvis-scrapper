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
  Radar,
  Search,
  Globe,
  Send,
  BarChart3,
  History,
  Download,
  Plug,
  Shield,
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
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border/50 bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/30">
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
      <nav className="flex flex-1 flex-col gap-5 px-3 py-5 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[9px] font-semibold text-ink-dim uppercase tracking-[0.2em]">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usage bar */}
      <div className="border-t border-border/30 px-5 py-4 space-y-3">
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
