import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  size?: number;
  stroke?: number;
  className?: string;
}

/** Anillo de puntaje de oportunidad: verde ≥70, ámbar ≥40, rojo por debajo. */
export function ScoreRing({ score, size = 40, stroke = 3, className }: ScoreRingProps) {
  const value = score ?? 0;
  const hasScore = score !== null;
  const radius = (size - stroke - 1) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 70 ? "stroke-accent" : value >= 40 ? "stroke-amber" : "stroke-red";
  const text = value >= 70 ? "text-accent" : value >= 40 ? "text-amber" : "text-red";

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={hasScore ? `Oportunidad ${value} de 100` : "Lead sin analizar"}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="stroke-border/50" />
        {hasScore && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className={cn("transition-all duration-700", color)}
          />
        )}
      </svg>
      <span className={cn("absolute font-mono font-bold", hasScore ? text : "text-ink-dim")} style={{ fontSize: Math.max(10, size * 0.3) }}>
        {hasScore ? value : "…"}
      </span>
    </div>
  );
}
