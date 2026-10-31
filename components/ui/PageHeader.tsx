import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
        <h1 className="font-serif text-[clamp(28px,4vw,42px)] font-semibold leading-tight tracking-[0.02em] text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow ? <div className="eyebrow mb-2">{eyebrow}</div> : null}
        <h2 className="font-serif text-[clamp(22px,2.6vw,30px)] font-semibold leading-snug text-ink">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
