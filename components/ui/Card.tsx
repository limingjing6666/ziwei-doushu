import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "tint" | "paper";
}

/** 纸面卡片：细线 + 浅底，不用阴影。 */
export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-line/12",
        tone === "default" && "bg-surface",
        tone === "tint" && "bg-surface-2",
        tone === "paper" && "bg-paper",
        className,
      )}
      {...props}
    />
  );
}
