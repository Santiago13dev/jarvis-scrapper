"use client";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-9 w-9 items-center justify-center", className)}>
      {/* Diamond shape */}
      <div className="absolute inset-0 rotate-45 rounded-lg bg-accent/20 border border-accent/30" />
      <div className="absolute inset-[3px] rotate-45 rounded-md bg-accent/30" />
      {/* Center dot */}
      <div className="relative h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(130,90,255,0.6)]" />
    </div>
  );
}
