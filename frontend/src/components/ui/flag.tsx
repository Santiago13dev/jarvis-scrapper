import { cn } from "@/lib/utils";
import { COUNTRY_META } from "@/lib/sections";

/** Banderas en SVG: Windows no dibuja los emojis de bandera (muestra "CO", "ES"…). */
export function Flag({ code, className }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  const name = COUNTRY_META[code]?.name ?? code;
  const base = cn("inline-block h-[0.85em] w-[1.25em] shrink-0 overflow-hidden rounded-[2px] align-[-0.05em] ring-1 ring-white/10", className);

  if (code === "CO") {
    return (
      <svg viewBox="0 0 3 2" className={base} role="img" aria-label={name}>
        <rect width="3" height="1" fill="#FCD116" />
        <rect y="1" width="3" height="0.5" fill="#003893" />
        <rect y="1.5" width="3" height="0.5" fill="#CE1126" />
      </svg>
    );
  }
  if (code === "ES") {
    return (
      <svg viewBox="0 0 3 2" className={base} role="img" aria-label={name}>
        <rect width="3" height="2" fill="#AA151B" />
        <rect y="0.5" width="3" height="1" fill="#F1BF00" />
      </svg>
    );
  }
  if (code === "US") {
    return (
      <svg viewBox="0 0 19 10" className={base} role="img" aria-label={name}>
        <rect width="19" height="10" fill="#B22234" />
        {[1, 3, 5, 7, 9, 11].map((stripe) => <rect key={stripe} y={(stripe * 10) / 13} width="19" height={10 / 13} fill="#fff" />)}
        <rect width="7.6" height={(7 * 10) / 13} fill="#3C3B6E" />
      </svg>
    );
  }
  return <span className={cn("font-mono text-[0.7em]", className)}>{code}</span>;
}
