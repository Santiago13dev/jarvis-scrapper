"use client";

import { cn } from "@/lib/utils";

/** Orbe grande de Jarvis para login y portada: anillos HUD, barrido y núcleo que respira. */
export function JarvisOrb({ className, state = "idle" }: { className?: string; state?: "idle" | "thinking" | "success" }) {
  const core = state === "success" ? "bg-accent shadow-[0_0_60px_rgb(var(--accent)/0.9)]" : "bg-accent shadow-[0_0_40px_rgb(var(--accent)/0.75)]";
  return (
    <div className={cn("relative aspect-square", className)} aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.18),transparent_65%)]" />
      <svg viewBox="0 0 200 200" className="orb-spin absolute inset-0 h-full w-full">
        <circle cx="100" cy="100" r="94" fill="none" stroke="rgb(var(--accent))" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 6" />
        <path d="M100 6 A94 94 0 0 1 194 100" fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M100 194 A94 94 0 0 1 6 100" fill="none" stroke="rgb(var(--accent))" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 200 200" className={cn("absolute inset-[14%] h-[72%] w-[72%]", state === "thinking" ? "orb-spin" : "orb-spin-reverse")}>
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgb(var(--cyan))" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="40 14 6 14" />
      </svg>
      <svg viewBox="0 0 200 200" className="orb-spin absolute inset-[28%] h-[44%] w-[44%]">
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgb(var(--violet))" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="8 10" />
      </svg>
      <div className="absolute inset-[40%] flex items-center justify-center">
        <div className={cn("orb-breathe h-full w-full rounded-full transition-all duration-500", core)} />
      </div>
    </div>
  );
}
