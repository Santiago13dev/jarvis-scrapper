import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  size?: number;
}

export function ScoreRing({ score, size = 40 }: ScoreRingProps) {
  const value = score ?? 0;
  const hasScore = score !== null;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color = !hasScore ? "stroke-ink-dim/30" : value >= 70 ? "stroke-teal" : value >= 40 ? "stroke-accent" : "stroke-red";

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}
      role="img" aria-label={hasScore ? `Lead score ${value} de 100` : "Lead sin analizar"}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={3} fill="none" className="stroke-border/40" />
        {hasScore && (
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={3} fill="none"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className={cn("transition-all duration-500", color)} />
        )}
      </svg>
      <span className="absolute font-mono-data text-[10px] font-medium text-ink">{hasScore ? value : "—"}</span>
    </div>
  );
}
