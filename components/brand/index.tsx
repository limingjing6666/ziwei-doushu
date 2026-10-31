import { cn } from "@/lib/ui/cn";

/** 朱砂方印：品牌符号，全站每屏最多出现一次。 */
export function Seal({
  size = 28,
  className,
  label = "天",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center rounded-xs border border-cinnabar/70 bg-cinnabar/10 font-serif font-semibold leading-none text-cinnabar",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.52 }}
    >
      {label}
    </span>
  );
}

/** 品牌字标：宋体「天机盘」+ 可选方印。 */
export function Wordmark({
  withSeal = true,
  className,
}: {
  withSeal?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {withSeal && <Seal size={26} />}
      <span className="font-serif text-[17px] font-semibold tracking-[0.14em] text-ink">
        天机盘
      </span>
    </span>
  );
}
