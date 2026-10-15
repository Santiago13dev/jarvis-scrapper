"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, TONES } from "@/lib/sections";
import { Logo } from "./logo";

export function Sidebar({ badges }: { badges: { approvals: number } }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 flex h-[68px] border-t border-border bg-sidebar/95 px-1 pb-[max(env(safe-area-inset-bottom),0px)] backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:shrink-0 lg:flex-col lg:border-r lg:border-t-0 lg:bg-sidebar lg:px-0 lg:pb-0 lg:backdrop-blur-none">
      {/* Marca */}
      <Link href="/dashboard" className="hidden h-[72px] items-center gap-3 px-6 lg:flex">
        <Logo className="h-8 w-8" />
        <span className="font-display text-[16px] font-bold tracking-tight text-ink">
          Jarvis <span className="neon-text text-accent">IA</span>
        </span>
      </Link>

      {/* Navegación */}
      <nav className="flex flex-1 items-center justify-around gap-1 overflow-x-auto lg:flex-col lg:items-stretch lg:justify-start lg:gap-6 lg:overflow-y-auto lg:px-3 lg:pb-6 lg:pt-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="contents lg:block">
            <p className="mb-1.5 hidden px-3 text-[11px] font-medium text-ink-dim lg:block">{section.label}</p>
            <div className="contents lg:flex lg:flex-col lg:gap-0.5">
              {section.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                const Icon = item.icon;
                const badge = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.hint}
                    className={cn(
                      "group relative flex min-w-[58px] flex-col items-center gap-1 rounded-lg px-2 py-2 text-[9px] font-medium transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:py-2 lg:text-[13.5px]",
                      isActive ? "bg-white/[0.06] text-ink" : "text-ink-muted hover:bg-white/[0.03] hover:text-ink",
                    )}
                  >
                    {isActive && <span className="neon-dot absolute -left-3 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent lg:block" />}
                    <Icon
                      size={17}
                      strokeWidth={1.8}
                      className={cn("shrink-0 transition-colors", isActive ? TONES[item.tone].text : "text-ink-dim group-hover:text-ink-muted")}
                    />
                    <span className="max-w-[64px] truncate lg:max-w-none">{item.label}</span>
                    {badge > 0 && (
                      <span className="absolute right-1 top-1 min-w-[20px] rounded-full bg-accent px-1.5 text-center font-mono text-[10px] font-bold leading-[18px] text-accent-ink lg:static lg:ml-auto">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-border px-6 py-4 lg:block">
        <p className="flex items-center gap-2 text-[12px] text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent))]" />
          Jarvis en línea
        </p>
      </div>
    </aside>
  );
}
