import { type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-void">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar workspaceName="Agencia Demo" />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 pb-24 mesh-gradient sm:p-6 sm:pb-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
