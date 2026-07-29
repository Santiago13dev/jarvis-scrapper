import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  size?: number;
}

/**
 * Elemento de firma del producto: el Lead Score no se muestra como un badge
 * plano, sino como un anillo de intensidad de señal — conecta la metáfora de
 * "radar de prospección" con la pieza de UI más usada de todo ProspectAI.
 */
export function ScoreRing({ score, size = 40 }: ScoreRingProps) {
  const value = score ?? 0;
  const hasScore = score !== null;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color = !hasScore
    ? "stroke-ink-muted/30"
    : value >= 70
      ? "stroke-signal-teal"
      : value >= 40
        ? "stroke-signal-amber"
        : "stroke-signal-red";

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={hasScore ? `Lead score ${value} de 100` : "Lead sin analizar"}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={3}
          fill="none"
          className="stroke-hairline"
        />
        {hasScore && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={3}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn("transition-all duration-500", color)}
          />
        )}
      </svg>
      <span className="absolute font-mono-data text-[11px] font-medium text-ink">
        {hasScore ? value : "—"}
      </span>
    </div>
  );
}
