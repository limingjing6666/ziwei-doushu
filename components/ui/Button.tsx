import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-11 px-6 text-[15px]",
    variant === "primary" &&
      "bg-cinnabar-fill text-paper-fixed hover:bg-cinnabar-deep",
    variant === "secondary" &&
      "border border-line/25 bg-surface text-ink hover:border-line/40 hover:bg-surface-2",
    variant === "ghost" &&
      "border border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
    variant === "quiet" &&
      "h-auto px-1 text-cinnabar underline-offset-4 hover:underline",
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
