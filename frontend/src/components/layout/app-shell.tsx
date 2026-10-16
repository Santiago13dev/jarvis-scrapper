"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { api } from "@/lib/api-client";
import type { OutreachDraft, User } from "@/types/api";

export function AppShell({ children }: { children: ReactNode }) {
  const { workspaces, workspaceId } = useActiveWorkspace();
  const workspace = workspaces?.find((item) => item.id === workspaceId);
  const [user, setUser] = useState<User | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    api.get<User>("/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    async function refresh() {
      try {
        const drafts = await api.get<OutreachDraft[]>(
          `/workspaces/${workspaceId}/automation/outreach?status_filter=pending_approval&limit=1000`,
        );
        if (!cancelled) setPendingApprovals(drafts.length);
      } catch {
        // El contador es informativo: si falla, la navegación sigue funcionando
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [workspaceId]);

  return (
    <div className="flex min-h-dvh bg-void">
      <Sidebar badges={{ approvals: pendingApprovals }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspaceName={workspace?.name ?? "Workspace"} userName={user?.full_name ?? null} />
        <main className="jarvis-backdrop min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-24 pt-6 sm:px-6 sm:pb-10 lg:px-10 lg:pt-8">
          <div className="rise-in mx-auto max-w-[1360px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
