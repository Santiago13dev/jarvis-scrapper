import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20",
  secondary: "bg-input text-ink border border-border/50 hover:border-accent/40 hover:bg-card-hover",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-white/5",
  danger: "bg-red/15 text-red border border-red/30 hover:bg-red/25",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium",
        "transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
