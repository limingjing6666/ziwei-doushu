import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * 受控分段选择（本命 / 大限 / 流年、男 / 女 等）。
 * 语义为 radiogroup，键盘方向键可由浏览器原生 radio 行为覆盖。
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border border-line/20 bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-xs font-medium transition-colors disabled:opacity-40",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]",
              active
                ? "bg-surface text-ink shadow-none"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
