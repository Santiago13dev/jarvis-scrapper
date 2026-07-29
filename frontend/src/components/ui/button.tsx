import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-signal-amber text-void hover:bg-signal-amber/90",
  secondary: "bg-surface-raised text-ink border border-hairline hover:border-signal-amber/40",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface-raised",
  danger: "bg-signal-red/15 text-signal-red border border-signal-red/30 hover:bg-signal-red/25",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium",
        "transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
