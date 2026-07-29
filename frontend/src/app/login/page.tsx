"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { api, ApiError } from "@/lib/api-client";

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<TokenPairResponse>("/auth/login", { email, password });
      window.localStorage.setItem("prospectai_access_token", result.access_token);
      window.localStorage.setItem("prospectai_refresh_token", result.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo />
          <h1 className="font-display text-xl font-medium text-ink">Entrar a ProspectAI</h1>
          <p className="text-sm text-ink-muted">Consola de prospección de tu agencia</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-ink-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-signal-amber/50"
              placeholder="tu@agencia.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-ink-muted">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-signal-amber/50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded border border-signal-red/30 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
