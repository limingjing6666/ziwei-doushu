import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="面包屑" className={cn("text-[13px] text-ink-3", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-ink-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-ink-2" : undefined} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? (
                <span aria-hidden="true" className="text-ink-3/60">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
