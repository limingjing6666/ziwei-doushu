import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-line/20 bg-surface/50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-ink-3">{icon}</div> : null}
      <p className="font-serif text-[17px] font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
