"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Radar, Users, Megaphone, Phone, ArrowRight, BarChart3, Download, Star, Globe, MapPin } from "lucide-react";

const FEATURES = [
  {
    icon: Radar,
    title: "Negocios reales de Google Maps",
    desc: "Busca por tipo de negocio y barrio. Obtén teléfono, WhatsApp, reseñas, redes sociales y página web.",
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
  },
  {
    icon: Users,
    title: "Potencial de venta",
    desc: "Cada negocio recibe un puntaje de 0 a 100: buena reputación y sin página propia = oportunidad alta.",
    iconBg: "bg-teal/15",
    iconColor: "text-teal",
  },
  {
    icon: Megaphone,
    title: "Contactar hoy",
    desc: "Una lista diaria con los mejores prospectos y su mensaje personalizado. Seguimientos automáticos a los 3 días.",
    iconBg: "bg-blue/15",
    iconColor: "text-blue",
  },
  {
    icon: Phone,
    title: "WhatsApp sin bloqueos",
    desc: "Envía desde tu propio WhatsApp en modo asistido o automatiza con la API oficial de Meta cuando crezcas.",
    iconBg: "bg-amber/15",
    iconColor: "text-amber",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <span className="font-display text-[15px] font-bold tracking-tight text-ink block leading-tight">JarvisIA</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/login" className="whitespace-nowrap text-[13px] text-ink-muted hover:text-ink transition-colors">Iniciar sesión</Link>
            <Link href="/register" className="hidden items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover sm:inline-flex">
              Comenzar gratis <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
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
            <span className="text-[11px] text-ink-muted font-medium">Para agencias y freelancers que venden servicios digitales</span>
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl">
            Encuentra negocios.<br />
            <span className="text-accent">Escríbeles hoy.</span><br />
            Cierra más ventas.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            JarvisIA busca negocios en Google Maps, detecta cuáles necesitan presencia digital y te prepara cada mensaje de WhatsApp para que solo tengas que enviarlo.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Link href="/register">
              <Button className="bg-accent hover:bg-accent-hover text-white text-base px-8 py-3 h-auto">
                Empezar ahora <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-base px-8 py-3 h-auto">Ya tengo cuenta</Button>
            </Link>
          </div>

        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-[11px] text-accent uppercase tracking-[0.2em] font-semibold mb-3">Capacidades</p>
            <h2 className="font-display text-2xl font-bold text-ink sm:text-3xl">De la búsqueda al primer mensaje en minutos</h2>
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
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-accent/5" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-2xl font-bold text-ink mb-4 sm:text-3xl">¿Listo para conseguir tus próximos clientes?</h2>
          <p className="text-ink-muted mb-8">Haz tu primera búsqueda en menos de 5 minutos.</p>
          <Link href="/register">
            <Button className="bg-accent hover:bg-accent-hover text-white text-base px-8 py-3 h-auto">
              Crear cuenta gratis <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
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
