import { cn } from "@/lib/ui/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse-soft rounded-sm bg-surface-2", className)}
      {...props}
    />
  );
}

export function Spinner({
  className,
  label = "加载中",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex", className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line/25 border-t-cinnabar" />
    </span>
  );
}
