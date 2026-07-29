"use client";

import { Search } from "lucide-react";

export function Topbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-6">
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-1.5 text-sm text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" />
        {workspaceName}
      </div>

      <div className="relative w-full max-w-sm">
        <Search
          size={15}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="text"
          placeholder="Buscar leads, campañas..."
          className="w-full rounded border border-hairline bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-signal-amber/50"
        />
      </div>

      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-ink">
        AG
      </div>
    </header>
  );
}
