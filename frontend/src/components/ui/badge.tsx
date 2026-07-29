import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "amber" | "teal" | "red";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-ink-muted border-hairline",
  amber: "bg-signal-amber/15 text-signal-amber border-signal-amber/30",
  teal: "bg-signal-teal/15 text-signal-teal border-signal-teal/30",
  red: "bg-signal-red/15 text-signal-red border-signal-red/30",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  new: "neutral",
  contacted: "amber",
  replied: "amber",
  qualified: "teal",
  demo_sent: "teal",
  won: "teal",
  lost: "red",
  draft: "neutral",
  scheduled: "amber",
  running: "teal",
  paused: "amber",
  finished: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>
  );
}
