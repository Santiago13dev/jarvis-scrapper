"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavItem = { href: string; label: string; short?: string; icon: LucideIcon; mobile?: boolean };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "PROSPECCIÓN",
    items: [
      { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, mobile: true },
      { href: "/leads", label: "Leads", icon: Users, mobile: true },
      { href: "/outreach", label: "Contactar hoy", short: "Contactar", icon: Send, mobile: true },
    ],
  },
  {
    label: "MENSAJES",
    items: [
      { href: "/conversations", label: "Conversaciones", short: "Chats", icon: MessageCircle, mobile: true },
      { href: "/campaigns", label: "Campañas", icon: Megaphone },
      { href: "/templates", label: "Plantillas", icon: FileText },
      { href: "/whatsapp", label: "WhatsApp", icon: Phone },
    ],
  },
  {
    label: "AJUSTES",
    items: [{ href: "/settings", label: "Configuración", icon: Settings }],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);

export function Sidebar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname?.startsWith(href) ?? false;
  const extra = ALL_ITEMS.filter((item) => !item.mobile);
  const extraActive = extra.some((item) => isActive(item.href));

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      {/* Escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar lg:flex">
        <Link href="/dashboard" className="flex items-center gap-3 border-b border-border/30 px-5 py-5">
          <Logo />
          <div>
            <span className="block font-display text-[15px] font-bold leading-tight tracking-tight text-ink">JarvisIA</span>
            <span className="text-[10px] text-ink-dim">Prospección inteligente</span>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5" aria-label="Navegación principal">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-dim">{section.label}</p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                        active ? "border-accent/20 bg-accent/15 text-accent" : "border-transparent text-ink-muted hover:bg-white/5 hover:text-ink",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} className={cn("shrink-0", active ? "text-accent" : "text-ink-dim group-hover:text-ink-muted")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/30 px-5 py-4">
          <p className="text-[11px] leading-relaxed text-ink-dim">Busca negocios, revisa su potencial y escríbeles desde «Contactar hoy».</p>
        </div>
      </aside>

      {/* Móvil */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-3 bottom-[80px] rounded-2xl border border-border/50 bg-card p-2 shadow-2xl"
          >
            {extra.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-[14px]",
                    isActive(item.href) ? "bg-accent/15 text-accent" : "text-ink hover:bg-white/5",
                  )}
                >
                  <Icon size={17} strokeWidth={1.75} /> {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border/60 bg-sidebar/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {ALL_ITEMS.filter((item) => item.mobile).map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", active ? "text-accent" : "text-ink-muted")}
            >
              <Icon size={19} strokeWidth={1.75} />
              {item.short ?? item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium", moreOpen || extraActive ? "text-accent" : "text-ink-muted")}
        >
          <MoreHorizontal size={19} strokeWidth={1.75} />
          Más
        </button>
      </nav>
    </>
  );
}
