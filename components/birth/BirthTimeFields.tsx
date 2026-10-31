"use client";

import { Field, Select } from "@/components/ui/Field";
import { SHICHEN } from "@/lib/ziwei/constants";
import { cn } from "@/lib/ui/cn";

/** 出生时间：北京时间 → 真太阳时时辰预览；未知时辰时整块禁用。 */
export default function BirthTimeFields({
  idPrefix,
  clockHour,
  clockMinute,
  unknownTime,
  branch,
  onHourChange,
  onMinuteChange,
  onUnknownTimeChange,
  compact = false,
  errors = {},
  useTrueSolar = true,
}: {
  idPrefix: string;
  clockHour: string;
  clockMinute: string;
  unknownTime: boolean;
  /** 真太阳时对应的时辰支（0–11），由表单统一计算 */
  branch: number;
  onHourChange: (hour: string) => void;
  onMinuteChange: (minute: string) => void;
  onUnknownTimeChange: (unknown: boolean) => void;
  compact?: boolean;
  errors?: Record<string, string>;
  useTrueSolar?: boolean;
}) {
  const hourId = `${idPrefix}-clock-hour`;
  const minuteId = `${idPrefix}-clock-minute`;
  const shichen = SHICHEN[branch];

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <fieldset
        disabled={unknownTime}
        className={cn(
          "m-0 min-w-0 rounded-sm border border-line/12 bg-surface-2/60 px-3 py-3 transition-opacity duration-150",
          unknownTime && "opacity-40",
        )}
      >
        <legend className="sr-only">出生时间（北京时间）</legend>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Field id={hourId} label="时" error={errors.clockHour}>
            <Select
              id={hourId}
              invalid={!!errors.clockHour}
              value={clockHour}
              onChange={(event) => onHourChange(event.target.value)}
            >
              <option value="">小时</option>
              {Array.from({ length: 24 }, (_, index) => index).map((hour) => (
                <option key={hour} value={String(hour)}>
                  {String(hour).padStart(2, "0")} 时
                </option>
              ))}
            </Select>
          </Field>

          <Field id={minuteId} label="分" error={errors.clockMinute}>
            <Select
              id={minuteId}
              invalid={!!errors.clockMinute}
              value={clockMinute}
              onChange={(event) => onMinuteChange(event.target.value)}
            >
              <option value="">分钟</option>
              {Array.from({ length: 60 }, (_, index) => index).map((minute) => (
                <option key={minute} value={String(minute)}>
                  {String(minute).padStart(2, "0")} 分
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 border-t border-line/12 pt-2.5">
          {unknownTime ? (
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              时辰不详，按子时（23:00–01:00）起盘
            </p>
          ) : clockHour === '' || clockMinute === '' ? <p className="text-xs text-ink-3">请选择出生时间，或明确勾选未知。</p> : (
            <p className="text-[13px] text-ink-2" aria-live="polite">
              {useTrueSolar ? '真太阳时' : '钟表时间'}{" "}
              <span className="font-serif text-[18px] font-semibold tracking-[0.03em] text-ink">
                {shichen.name}
              </span>
              <span className="ml-1 font-mono text-[12px] text-ink-3">
                （{shichen.range}）
              </span>
            </p>
          )}
        </div>
      </fieldset>

      <label className="flex min-h-10 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={unknownTime}
          onChange={(event) => onUnknownTimeChange(event.target.checked)}
          className="h-4 w-4 shrink-0 accent-cinnabar"
        />
        <span className="text-[13px] leading-relaxed text-ink-2">
          不知道出生时间，以子时（23:00–01:00）起盘
        </span>
      </label>
    </div>
  );
}
