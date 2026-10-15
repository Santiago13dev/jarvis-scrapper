"use client";

import { cn } from "@/lib/utils";

/** Orbe de Jarvis: núcleo verde neón con anillos HUD girando. */
export function Logo({ className, animated = true }: { className?: string; animated?: boolean }) {
  return (
    <div className={cn("relative flex h-9 w-9 items-center justify-center", className)} aria-hidden>
      <svg viewBox="0 0 40 40" className={cn("absolute inset-0 h-full w-full", animated && "orb-spin")}>
        <circle cx="20" cy="20" r="18" fill="none" stroke="rgb(var(--accent))" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="20 8 4 8" />
      </svg>
      <svg viewBox="0 0 40 40" className={cn("absolute inset-0 h-full w-full", animated && "orb-spin-reverse")}>
        <circle cx="20" cy="20" r="13" fill="none" stroke="rgb(var(--cyan))" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="3 5" />
      </svg>
      <div className={cn("relative h-[38%] w-[38%] rounded-full bg-accent shadow-[0_0_14px_rgb(var(--accent)/0.9)]", animated && "orb-breathe")} />
    </div>
  );
}
