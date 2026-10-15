import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONES, type ToneName } from "@/lib/sections";

/** Superficie base: una sola tarjeta neutra con título opcional. Evita cajas dentro de cajas. */
export function Panel({
  title, description, action, children, className, bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[12.5px] text-ink-dim">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("px-6 pb-6", title || action ? "pt-4" : "pt-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink">
      {children} →
    </Link>
  );
}

/** Indicador numérico sobrio: el color vive solo en el ícono. */
export function Stat({
  icon: Icon, label, value, hint, tone = "gray", href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  tone?: ToneName;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
        <Icon size={15} className={TONES[tone].text} strokeWidth={2} />
        {label}
      </div>
      <p className="mt-3 font-display text-[28px] font-semibold leading-none tracking-tight text-ink">
        {typeof value === "number" ? value.toLocaleString("es-CO") : value}
      </p>
      {hint && <p className="mt-2 text-[12px] text-ink-dim">{hint}</p>}
    </>
  );
  const className = "block rounded-2xl border border-border bg-card px-5 py-4 transition-colors";
  return href ? (
    <Link href={href} className={cn(className, "hover:border-border-light hover:bg-card-hover")}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
