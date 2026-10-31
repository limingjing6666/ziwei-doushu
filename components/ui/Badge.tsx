import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type BadgeTone = "default" | "muted" | "accent" | "lu" | "quan" | "ke" | "ji";

const TONES: Record<BadgeTone, string> = {
  default: "border-line/20 bg-surface-2 text-ink-2",
  muted: "border-line/12 bg-transparent text-ink-3",
  accent: "border-cinnabar/30 bg-cinnabar/8 text-cinnabar",
  lu: "border-jade/25 bg-jade/10 text-jade",
  quan: "border-indigo/25 bg-indigo/10 text-indigo",
  ke: "border-ochre/30 bg-ochre/10 text-ochre",
  ji: "border-cinnabar/28 bg-cinnabar/10 text-cinnabar",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-[12px] leading-5",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const SIHUA_TONE: Record<string, BadgeTone> = {
  禄: "lu",
  权: "quan",
  科: "ke",
  忌: "ji",
};

/** 四化徽章：禄 / 权 / 科 / 忌。文字始终保留，不单靠颜色区分。 */
export function SiHuaBadge({
  siHua,
  overlay = false,
  label,
  className,
}: {
  siHua: string;
  overlay?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-1 text-[11px] font-semibold leading-[1.5]",
        SIHUA_TONE[siHua] === "lu" && "border-jade/30 bg-jade/10 text-jade",
        SIHUA_TONE[siHua] === "quan" && "border-indigo/30 bg-indigo/10 text-indigo",
        SIHUA_TONE[siHua] === "ke" && "border-ochre/35 bg-ochre/10 text-ochre",
        SIHUA_TONE[siHua] === "ji" && "border-cinnabar/32 bg-cinnabar/10 text-cinnabar",
        overlay && "border-dashed opacity-85",
        className,
      )}
      title={overlay ? `运限叠加：${label ?? ""}${siHua}` : `生年四化：${siHua}`}
    >
      {overlay && label ? <span className="mr-0.5 opacity-75">{label}</span> : null}
      {siHua}
    </span>
  );
}
