"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { JarvisOrb } from "@/components/ui/jarvis-orb";
import { api, ApiError } from "@/lib/api-client";
import { ArrowRight, CheckCircle } from "lucide-react";

interface RegisterResponse {
  organization_id: string;
  workspace_id: string;
  user_id: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post<RegisterResponse>("/auth/register", {
        organization_name: orgName,
        admin_full_name: fullName,
        admin_email: email,
        admin_password: password,
      });
      const loginResult = await api.post<{ access_token: string; refresh_token: string; user_id: string }>(
        "/auth/login",
        { email, password }
      );
      window.localStorage.setItem("jarvisia_access_token", loginResult.access_token);
      window.localStorage.setItem("jarvisia_refresh_token", loginResult.refresh_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="jarvis-backdrop relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-4 py-10">

      <div className="relative w-full max-w-[400px]">
        <div className="neon-ring rounded-3xl border border-accent/20 bg-card/80 p-8 backdrop-blur-xl">
          <div className="mb-6 flex flex-col items-center gap-4">
            <JarvisOrb className="w-20" state={loading ? "thinking" : "idle"} />
            <div className="text-center">
              <h1 className="font-display text-xl font-bold text-ink">Hola, soy <span className="text-accent neon-text">Jarvis</span></h1>
              <p className="text-[13px] text-ink-muted mt-1">Crea tu cuenta y empecemos a conseguir clientes</p>
            </div>
          </div>

          <div className="mb-6 space-y-2">
            {["Clientes en Colombia, España y Estados Unidos", "Puntaje de oportunidad por servicio", "Mensajes personalizados que tú apruebas"].map((b) => (
              <div key={b} className="flex items-center gap-2 text-[12px] text-ink-muted">
                <CheckCircle size={12} className="text-accent shrink-0" />
                <span>{b}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="orgName" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Nombre de la agencia</label>
              <input id="orgName" type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                placeholder="Mi Agencia" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Tu nombre</label>
              <input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                placeholder="Juan Perez" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                placeholder="tu@agencia.com" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Contraseña (min. 8)</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-input px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                placeholder="••••••••" />
            </div>

            {error && (
              <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-[13px] text-red">{error}</div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent-hover text-accent-ink py-2.5">
              {loading ? "Creando..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-accent hover:text-accent-hover font-medium transition-colors">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
