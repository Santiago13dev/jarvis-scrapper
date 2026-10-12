"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { ArrowRight, Mail, Lock, Eye, EyeOff, CheckCircle2, Shield, TrendingUp, Brain } from "lucide-react";

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}

function JarvisIcon({ className }: { className?: string }) {
  // Id único por instancia: si se repite, el degradado falla cuando la primera copia está oculta.
  const grad = `grad-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#a78bff" />
          <stop offset="100%" stopColor="#825aff" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="#0d0f1a" stroke={`url(#${grad})`} strokeWidth="1.75" />
      <line x1="20" y1="5.5" x2="20" y2="9" stroke={`url(#${grad})`} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="4.5" r="1.4" fill="#a78bff" />
      <path d="M11 16c0-3 2.5-5 5-5" stroke={`url(#${grad})`} strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
      <path d="M29 16c0-3-2.5-5-5-5" stroke={`url(#${grad})`} strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
      <circle cx="14.5" cy="19.5" r="2.1" fill="#a78bff" />
      <circle cx="25.5" cy="19.5" r="2.1" fill="#a78bff" />
      <path d="M13.5 26.5c1.8 1.8 4.2 2.8 6.5 2.8s4.7-1 6.5-2.8" stroke={`url(#${grad})`} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<TokenPairResponse>("/auth/login", { email, password });
      window.localStorage.setItem("jarvisia_access_token", result.access_token);
      window.localStorage.setItem("jarvisia_refresh_token", result.refresh_token);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex overflow-hidden bg-[#0d0f1a]">
      {/* Background spans the entire page so it doesn't cut off behind the modal */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_45%,rgba(130,90,255,0.35),transparent_65%)]" />
        {/* Robot desplazado a la izquierda; el borde derecho se funde con el fondo en vez de cortarse. */}
        <div className="absolute inset-y-0 -left-[20%] w-full [mask-image:linear-gradient(to_right,black_70%,transparent)]">
          <Image
            src="/jarvis-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ filter: "brightness(1.45) contrast(1.08) saturate(1.15)" }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#080a12]/55 via-transparent to-[#080a12]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080a12]/70 via-transparent to-[#080a12]/40" />
      </div>

      {/* Left side - Marketing content */}
      <div className="hidden lg:flex flex-1 relative z-10 items-center px-14 xl:px-20 2xl:px-24">
        <div className="relative z-10 max-w-xl">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <JarvisIcon className="h-9 w-9" />
            <span className="font-display text-2xl font-bold text-ink">jarvisIA</span>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Inteligencia artificial para prospección</span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-[1.15] mb-5">
            <span className="text-accent/90">Descubre negocios.</span><br />
            <span className="text-accent/90">Atrae clientes.</span><br />
            <span className="bg-gradient-to-r from-accent to-pink bg-clip-text text-transparent">Cierra más ventas.</span>
          </h1>

          <p className="text-[14px] text-ink-muted leading-relaxed mb-8 max-w-md">
            JarvisIA te ayuda a extraer, analizar y convertir negocios en oportunidades reales con el poder de la inteligencia artificial.
          </p>

          {/* Features */}
          <div className="space-y-4 mb-10">
            {[
              { icon: <CheckCircle2 size={16} />, title: "Negocios reales de Google Maps", desc: "Teléfono, WhatsApp, reseñas, redes y página web" },
              { icon: <TrendingUp size={16} />, title: "Potencial de venta", desc: "Prioriza a quien más necesita tus servicios" },
              { icon: <Brain size={16} />, title: "Mensajes personalizados", desc: "Plantillas con el nombre, la zona y la oportunidad de cada negocio" },
              { icon: <Shield size={16} />, title: "Respeta a quien dice no", desc: "Quien pide no ser contactado sale de tus listas" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full border border-accent/40 flex items-center justify-center text-accent shrink-0">{f.icon}</div>
                <div>
                  <p className="text-[13px] font-medium text-ink">{f.title}</p>
                  <p className="text-[11px] text-ink-dim">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Cómo funciona */}
          <ol className="grid grid-cols-3 gap-3 rounded-xl border border-border/30 bg-card/30 p-4 backdrop-blur-sm">
            {["Busca negocios por tipo y zona", "Jarvis los califica por potencial", "Escríbeles por WhatsApp en un toque"].map((step, index) => (
              <li key={step} className="text-[11px] leading-snug text-ink-muted">
                <span className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 font-mono text-[11px] font-bold text-accent">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Right side - only the login is a floating modal card, shifted left over the shared background */}
      <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 relative z-10 flex items-center justify-center px-4 py-10 sm:px-8 lg:justify-start lg:pl-8 lg:pr-14">
        <div className="w-full max-w-[420px] rounded-3xl border border-border/40 bg-card shadow-2xl shadow-black/40 px-6 py-8 sm:px-8 sm:py-10">

          <div className="text-center mb-8">
            <JarvisIcon className="h-14 w-14 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold text-ink">
              Bienvenido a <span className="text-accent">JarvisIA</span>
            </h2>
            <p className="text-[13px] text-ink-muted mt-1">Inicia sesión en tu consola de prospección</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Correo</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
                <input
                  id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@agencia.com"
                  className="w-full rounded-lg border border-border/50 bg-input pl-10 pr-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
                <input
                  id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border/50 bg-input pl-10 pr-10 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>


            {error && (
              <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-[12px] text-red">{error}</div>
            )}

            <Button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-accent to-pink hover:opacity-90 text-white py-2.5 font-medium text-[13px]">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Iniciar sesión <ArrowRight size={14} />
                </span>
              )}
            </Button>
          </form>


          <p className="mt-6 text-center text-[12px] text-ink-muted">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-accent hover:text-accent-hover font-medium transition-colors">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
