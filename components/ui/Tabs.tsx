import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export interface TabItem {
  key: string;
  label: ReactNode;
}

/** 受控 Tab 栏（下划线式，语义 tablist）。面板由调用方渲染。 */
export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-6 border-b border-line/12",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={active}
            aria-controls={`panel-${item.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative -mb-px border-b-2 border-transparent pb-2.5 text-sm transition-colors",
              active
                ? "border-cinnabar font-medium text-ink"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
