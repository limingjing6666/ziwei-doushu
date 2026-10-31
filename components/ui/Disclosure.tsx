import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { IconChevronDown } from "@/components/icons";

/** 原生 details 手风琴：零 JS、可键盘操作、可打印。 */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group border-b border-line/12 py-3.5", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <IconChevronDown
          size={16}
          className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="pt-2.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}
