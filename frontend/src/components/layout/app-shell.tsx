import { type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-void">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar workspaceName="Agencia Demo" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
