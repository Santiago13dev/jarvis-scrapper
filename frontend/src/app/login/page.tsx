"use client";

import { useState } from "react";
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
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="#a78bff" />
          <stop offset="100%" stopColor="#825aff" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="#0d0f1a" stroke="url(#grad)" strokeWidth="1.75" />
      <line x1="20" y1="5.5" x2="20" y2="9" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="4.5" r="1.4" fill="#a78bff" />
      <path d="M11 16c0-3 2.5-5 5-5" stroke="url(#grad)" strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
      <path d="M29 16c0-3-2.5-5-5-5" stroke="url(#grad)" strokeWidth="1.25" strokeLinecap="round" opacity="0.6" />
      <circle cx="14.5" cy="19.5" r="2.1" fill="#a78bff" />
      <circle cx="25.5" cy="19.5" r="2.1" fill="#a78bff" />
      <path d="M13.5 26.5c1.8 1.8 4.2 2.8 6.5 2.8s4.7-1 6.5-2.8" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" />
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
  const [remember, setRemember] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post<TokenPairResponse>("/auth/login", { email, password });
      window.localStorage.setItem("jarvisia_access_token", result.access_token);
      window.localStorage.setItem("jarvisia_refresh_token", result.refresh_token);
      router.push("/dashboard");
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
        <Image
          src="/jarvis-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute top-0 h-full w-[135%] object-cover"
          style={{ left: "-20%", filter: "brightness(1.45) contrast(1.08) saturate(1.15)" }}
        />
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
              { icon: <CheckCircle2 size={16} />, title: "Extrae negocios de Google Maps", desc: "Obtén información precisa y actualizada" },
              { icon: <Brain size={16} />, title: "Inteligencia Artificial", desc: "Analiza, segmenta y encuentra oportunidades" },
              { icon: <TrendingUp size={16} />, title: "Aumenta tus conversiones", desc: "Convierte leads en clientes fieles" },
              { icon: <Shield size={16} />, title: "Datos seguros", desc: "Tu información está protegida" },
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

          {/* Testimonial */}
          <div className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-4">
            <p className="text-[12px] text-ink-muted italic mb-3">&quot;La herramienta #1 para prospección inteligente&quot;</p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-border/30 border-2 border-[#080a12] flex items-center justify-center text-[10px] font-bold text-ink-dim">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
                <div className="h-8 w-8 rounded-full bg-accent/20 border-2 border-[#080a12] flex items-center justify-center text-[9px] font-bold text-accent">+2.5K</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} className="h-3 w-3 text-amber fill-amber" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                  <span className="text-[11px] font-bold text-ink ml-1">4.9/5</span>
                </div>
                <p className="text-[10px] text-ink-dim">Empresas que ya confían en JarvisIA</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - only the login is a floating modal card, shifted left over the shared background */}
      <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 relative z-10 flex items-center justify-start pl-6 lg:pl-8 pr-8 lg:pr-14 py-10">
        <div className="w-full max-w-[420px] rounded-3xl border border-border/40 bg-card shadow-2xl shadow-black/40 px-8 py-10">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <JarvisIcon className="h-9 w-9" />
            <span className="font-display text-2xl font-bold text-ink">jarvisIA</span>
          </div>

          <div className="text-center mb-8">
            <JarvisIcon className="h-14 w-14 mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold text-ink">
              Bienvenido a <span className="text-accent">JarvisIA</span>
            </h2>
            <p className="text-[13px] text-ink-muted mt-1">Inicia sesión en tu consola de prospección</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@agencia.com"
                  className="w-full rounded-lg border border-border/50 bg-input pl-10 pr-4 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
                <input
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border/50 bg-input pl-10 pr-10 py-2.5 text-[13px] text-ink placeholder:text-ink-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors outline-none"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border/50 bg-input accent-[#825aff]" />
                <span className="text-[12px] text-ink-muted">Recordarme</span>
              </label>
              <Link href="#" className="text-[12px] text-accent hover:text-accent-hover transition-colors">¿Olvidaste tu contraseña?</Link>
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

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/30" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-[11px] text-ink-dim">o continúa con</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-input py-2.5 text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 rounded-lg border border-border/40 bg-input py-2.5 text-[12px] font-medium text-ink-muted hover:text-ink hover:border-border transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 23 23"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
              Microsoft
            </button>
          </div>

          <p className="mt-6 text-center text-[12px] text-ink-muted">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-accent hover:text-accent-hover font-medium transition-colors">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
