"use client";

import { cn } from "@/lib/ui/cn";

const OPTIONS = [
  { value: "male" as const, label: "男" },
  { value: "female" as const, label: "女" },
];

/**
 * 性别选择：原生 radio + radiogroup 语义。
 *
 * 用原生 radio 而不是按钮组，是为了拿到浏览器内置的「方向键切换」，
 * 同时保留 ≥40px 的触控高度；视觉上与 SegmentedControl 同一套 token。
 * 选中态：朱砂 1px 边框 + 极低透明度朱砂底 + text-ink。
 */
export default function GenderSegment({
  name,
  value,
  onChange,
}: {
  /** radio name，同一页多个表单需唯一 */
  name: string;
  value: "male" | "female";
  onChange: (gender: "male" | "female") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="性别"
      className="flex h-11 w-full items-stretch gap-0.5 rounded-sm border border-line/20 bg-surface-2 p-0.5"
    >
      {OPTIONS.map((option) => {
        const id = `${name}-${option.value}`;
        const active = option.value === value;
        return (
          <div key={option.value} className="relative min-w-0 flex-1">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className={cn(
                "flex h-full w-full cursor-pointer select-none items-center justify-center rounded-xs border text-[13px] font-medium transition-colors",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cinnabar",
                active
                  ? "border-cinnabar bg-cinnabar/[0.06] text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}
