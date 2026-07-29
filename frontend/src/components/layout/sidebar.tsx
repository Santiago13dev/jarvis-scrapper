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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campañas", icon: Megaphone },
  { href: "/conversations", label: "Conversaciones", icon: MessageCircle },
  { href: "/templates", label: "Plantillas", icon: FileText },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo />
        <span className="font-display text-[15px] font-medium tracking-tight text-ink">
          ProspectAI
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-surface-raised text-ink"
                  : "text-ink-muted hover:bg-surface-raised hover:text-ink",
              )}
            >
              <Icon size={17} strokeWidth={1.75} />
              {item.label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-signal-amber" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-hairline px-5 py-4">
        <p className="text-xs text-ink-muted">Conectado vía OpenWA</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-teal" />
          <span className="text-xs text-ink">Sesión activa</span>
        </div>
      </div>
    </aside>
  );
}
