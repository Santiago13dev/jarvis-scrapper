import {
  Bot,
  CheckCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Phone,
  Search,
  Send,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Cada sección tiene un color de identidad. Las clases van escritas completas porque
 * Tailwind no detecta clases construidas dinámicamente (ej. `text-${color}`).
 */
export interface SectionTone {
  text: string;
  softBg: string;
  border: string;
  solid: string;
  glow: string;
  hoverBorder: string;
}

export const TONES = {
  green: { text: "text-accent", softBg: "bg-accent/10", border: "border-accent/30", solid: "bg-accent", glow: "shadow-[0_0_24px_rgb(var(--accent)/0.25)]", hoverBorder: "hover:border-accent/40" },
  cyan: { text: "text-cyan", softBg: "bg-cyan/10", border: "border-cyan/30", solid: "bg-cyan", glow: "shadow-[0_0_24px_rgb(var(--cyan)/0.25)]", hoverBorder: "hover:border-cyan/40" },
  violet: { text: "text-violet", softBg: "bg-violet/10", border: "border-violet/30", solid: "bg-violet", glow: "shadow-[0_0_24px_rgb(var(--violet)/0.25)]", hoverBorder: "hover:border-violet/40" },
  amber: { text: "text-amber", softBg: "bg-amber/10", border: "border-amber/30", solid: "bg-amber", glow: "shadow-[0_0_24px_rgb(var(--amber)/0.25)]", hoverBorder: "hover:border-amber/40" },
  blue: { text: "text-blue", softBg: "bg-blue/10", border: "border-blue/30", solid: "bg-blue", glow: "shadow-[0_0_24px_rgb(var(--blue)/0.25)]", hoverBorder: "hover:border-blue/40" },
  orange: { text: "text-orange", softBg: "bg-orange/10", border: "border-orange/30", solid: "bg-orange", glow: "shadow-[0_0_24px_rgb(var(--orange)/0.25)]", hoverBorder: "hover:border-orange/40" },
  pink: { text: "text-pink", softBg: "bg-pink/10", border: "border-pink/30", solid: "bg-pink", glow: "shadow-[0_0_24px_rgb(var(--pink)/0.25)]", hoverBorder: "hover:border-pink/40" },
  wa: { text: "text-wa", softBg: "bg-wa/10", border: "border-wa/30", solid: "bg-wa", glow: "shadow-[0_0_24px_rgb(var(--wa)/0.25)]", hoverBorder: "hover:border-wa/40" },
  gray: { text: "text-ink-muted", softBg: "bg-white/5", border: "border-border", solid: "bg-ink-muted", glow: "", hoverBorder: "hover:border-border-light" },
} satisfies Record<string, SectionTone>;

export type ToneName = keyof typeof TONES;

export interface NavItem {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: ToneName;
  badgeKey?: "approvals";
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Prospectar",
    items: [
      { href: "/dashboard", label: "Inicio", hint: "Tu resumen del día", icon: LayoutDashboard, tone: "green" },
      { href: "/leads", label: "Buscar clientes", hint: "Google Maps en CO, ES y EE. UU.", icon: Search, tone: "cyan" },
      { href: "/autopilot", label: "Piloto automático", hint: "Búsquedas que corren solas", icon: Bot, tone: "violet" },
    ],
  },
  {
    label: "Vender",
    items: [
      { href: "/approvals", label: "Aprobar mensajes", hint: "Revisa y envía con un clic", icon: CheckCheck, tone: "amber", badgeKey: "approvals" },
      { href: "/outreach", label: "Contactar hoy", hint: "Tu lista diaria para escribir por WhatsApp", icon: Send, tone: "green" },
      { href: "/conversations", label: "Conversaciones", hint: "Clientes que respondieron", icon: MessageCircle, tone: "blue" },
      { href: "/campaigns", label: "Campañas", hint: "Envíos agrupados", icon: Megaphone, tone: "orange" },
      { href: "/templates", label: "Plantillas", hint: "Mensajes reutilizables", icon: FileText, tone: "pink" },
    ],
  },
  {
    label: "Conexión",
    items: [
      { href: "/whatsapp", label: "WhatsApp", hint: "Conecta tu número", icon: Phone, tone: "wa" },
      { href: "/settings", label: "Configuración", hint: "Workspace e integraciones", icon: Settings, tone: "gray" },
    ],
  },
];

export function sectionFor(pathname: string | null): NavItem | undefined {
  return NAV_SECTIONS.flatMap((section) => section.items).find((item) => pathname?.startsWith(item.href));
}

export const SERVICE_META: Record<string, { label: string; short: string; color: string }> = {
  // Paleta categórica validada (modo oscuro, superficie #0d1012) — orden fijo
  landing: { label: "Landing Page", short: "Landing", color: "#11a957" },
  web: { label: "Web Corporativa", short: "Web", color: "#0b9fc0" },
  ecommerce: { label: "Tienda Virtual", short: "Tienda", color: "#8566ec" },
  seo: { label: "Posicionamiento SEO", short: "SEO", color: "#e07020" },
  ads: { label: "SEO + Google Ads", short: "Ads", color: "#d84f94" },
  whatsapp_ai: { label: "Asistente IA WhatsApp", short: "IA WhatsApp", color: "#b88600" },
};

export const COUNTRY_META: Record<string, { flag: string; name: string }> = {
  CO: { flag: "🇨🇴", name: "Colombia" },
  ES: { flag: "🇪🇸", name: "España" },
  US: { flag: "🇺🇸", name: "Estados Unidos" },
};

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
