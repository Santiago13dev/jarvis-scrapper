"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { greetingFor, sectionFor } from "@/lib/sections";

export function Topbar({ workspaceName, userName }: { workspaceName: string; userName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const section = sectionFor(pathname);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstName = userName?.split(" ")[0];
  const isHome = pathname?.startsWith("/dashboard");

  function logout() {
    window.localStorage.removeItem("jarvisia_access_token");
    window.localStorage.removeItem("jarvisia_refresh_token");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-border bg-void/85 px-4 backdrop-blur-xl sm:px-6 lg:h-[72px] lg:px-10">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[17px] font-semibold tracking-tight text-ink sm:text-[19px]">
          {isHome ? (
            <>
              {now ? greetingFor(now) : "Hola"}{firstName ? `, ${firstName}` : ""}
              <span className="ml-1.5 inline-block origin-[70%_70%] animate-[wave_2s_ease-in-out_1]">👋</span>
            </>
          ) : (
            section?.label ?? "Jarvis"
          )}
        </h1>
        <p className="hidden truncate text-[12.5px] text-ink-dim sm:block">
          {isHome
            ? `Bienvenido a Jarvis${now ? ` · ${now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}` : ""}`
            : section?.hint}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!pathname?.startsWith("/leads") && (
          <Link
            href="/leads?buscar=1"
            className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:border-border-light hover:bg-card-hover sm:flex"
          >
            <Search size={15} className="text-ink-muted" /> Buscar clientes
          </Link>
        )}
        <span className="hidden max-w-[160px] truncate rounded-lg px-3 py-2 text-[13px] text-ink-muted md:block">{workspaceName}</span>
        <button onClick={logout} title="Cerrar sesión" className="rounded-lg p-2 text-ink-dim transition-colors hover:bg-white/[0.04] hover:text-ink">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
