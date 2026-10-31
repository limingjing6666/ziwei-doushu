import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 必须提供，用于无障碍名称 */
  label: string;
  children: ReactNode;
  size?: "sm" | "md";
}

export function IconButton({
  label,
  children,
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-sm border border-transparent text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
