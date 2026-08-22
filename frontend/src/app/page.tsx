"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Radar, Users, Megaphone, Phone, ArrowRight, ChevronRight, BarChart3, Download, Star, Globe, MapPin } from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    title: "Radar de Prospección",
    desc: "Escanea Google Maps en tiempo real para detectar negocios potenciales en tu zona.",
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
  },
  {
    icon: Users,
    title: "Lead Scoring IA",
    desc: "Motor de scoring que evalúa cada lead según potencial, sector y proximidad.",
    iconBg: "bg-teal/15",
    iconColor: "text-teal",
  },
  {
    icon: Megaphone,
    title: "Campañas Automatizadas",
    desc: "Secuencias personalizadas de WhatsApp que se ejecutan solas, 24/7.",
    iconBg: "bg-blue/15",
    iconColor: "text-blue",
  },
  {
    icon: Phone,
    title: "WhatsApp Integrado",
    desc: "Conexión directa con tu número de WhatsApp. Sin APIs externas.",
    iconBg: "bg-amber/15",
    iconColor: "text-amber",
  },
];

const STATS = [
  { value: "12,540+", label: "Negocios extraídos" },
  { value: "85%", label: "Tasa de entrega" },
  { value: "3.2x", label: "Más respuestas" },
  { value: "24/7", label: "Operación continua" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <span className="font-display text-[15px] font-bold tracking-tight text-ink block leading-tight">JarvisIA</span>
              <span className="text-[9px] text-ink-dim uppercase tracking-[0.2em]">JarvisIA</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13px] text-ink-muted hover:text-ink transition-colors">Iniciar sesión</Link>
            <Link href="/register">
              <Button className="bg-accent hover:bg-accent-hover text-white">
                Comenzar gratis
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(ellipse 60% 50% at 30% 40%, rgba(130,90,255,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 70% 60%, rgba(70,140,255,0.05) 0%, transparent 60%)`,
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(130,90,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(130,90,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
            <span className="text-[11px] text-ink-muted font-medium">Sistema de prospección activo</span>
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-ink leading-tight tracking-tight">
            Detecta leads.<br />
            <span className="text-accent">Automatiza outreach.</span><br />
            Conecta más rápido.
          </h1>

          <p className="mt-6 text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            JarvisIA escanea negocios en Google Maps, los puntúa con IA y ejecuta campañas de WhatsApp automáticas.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button className="bg-accent hover:bg-accent-hover text-white text-base px-8 py-3 h-auto">
                Empezar ahora <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-base px-8 py-3 h-auto">Ver demo</Button>
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-display font-bold text-ink">{stat.value}</p>
                <p className="text-[11px] text-ink-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-[11px] text-accent uppercase tracking-[0.2em] font-semibold mb-3">Capacidades</p>
            <h2 className="font-display text-3xl font-bold text-ink">Todo lo que necesitas para escalar</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group rounded-xl border border-border/40 bg-card p-7 transition-all duration-300 hover:border-accent/25 hover:bg-card-hover card-glow">
                  <div className={`inline-flex rounded-lg ${f.iconBg} p-2.5 mb-4`}>
                    <Icon size={20} className={f.iconColor} />
                  </div>
                  <h3 className="font-display text-base font-bold text-ink mb-2">{f.title}</h3>
                  <p className="text-[13px] text-ink-muted leading-relaxed">{f.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] text-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Saber más <ChevronRight size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-accent/5" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink mb-4">¿Listo para automatizar tu prospección?</h2>
          <p className="text-ink-muted mb-8">Configura tu primer radar en menos de 5 minutos. Sin tarjeta de crédito.</p>
          <Link href="/register">
            <Button className="bg-accent hover:bg-accent-hover text-white text-base px-8 py-3 h-auto">
              Crear cuenta gratis <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Logo className="h-5 w-5" />
            <span className="font-bold">JarvisIA</span>
          </div>
          <p className="text-[11px] text-ink-dim">© 2026 JarvisIA. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
