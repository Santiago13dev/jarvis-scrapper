import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "amber" | "teal" | "red" | "purple" | "blue";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-ink-dim/15 text-ink-muted border-ink-dim/20",
  amber: "bg-amber/15 text-amber border-amber/25",
  teal: "bg-teal/15 text-teal border-teal/25",
  red: "bg-red/15 text-red border-red/25",
  purple: "bg-accent/15 text-accent border-accent/25",
  blue: "bg-blue/15 text-blue border-blue/25",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  new: "neutral",
  contacted: "blue",
  replied: "teal",
  qualified: "purple",
  demo_sent: "amber",
  won: "teal",
  lost: "red",
  draft: "neutral",
  scheduled: "amber",
  running: "teal",
  paused: "amber",
  finished: "purple",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>
      {status.replace("_", " ")}
    </Badge>
  );
}
