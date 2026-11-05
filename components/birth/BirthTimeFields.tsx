"use client";

import { Field, Select } from "@/components/ui/Field";
import { describeBirthTime } from "@/lib/birth-time";
import { cn } from "@/lib/ui/cn";
import type { BirthTimeMode } from '@/lib/birth-form';
import { SEGMENTS, type Segment } from '@/lib/ziwei/fuzzy-time';

/** 三档出生时间；大概档仅在提供选段能力时出现。 */
export default function BirthTimeFields({
  idPrefix,
  clockHour,
  clockMinute,
  timeMode,
  segment = '',
  allowSegment = false,
  onSegmentChange,
  branch,
  onHourChange,
  onMinuteChange,
  onTimeModeChange,
  compact = false,
  errors = {},
  useTrueSolar = true,
  city,
  longitude,
}: {
  idPrefix: string;
  clockHour: string;
  clockMinute: string;
  timeMode: BirthTimeMode;
  segment?: Segment | '';
  allowSegment?: boolean;
  onSegmentChange?: (segment: Segment) => void;
  /** 经度校正对应的时辰支（0–11），由表单统一计算 */
  branch: number;
  onHourChange: (hour: string) => void;
  onMinuteChange: (minute: string) => void;
  onTimeModeChange: (mode: BirthTimeMode) => void;
  compact?: boolean;
  errors?: Record<string, string>;
  useTrueSolar?: boolean;
  city: string;
  longitude: number;
}) {
  const unknownTime = timeMode === 'unknown';
  const hourId = `${idPrefix}-clock-hour`;
  const minuteId = `${idPrefix}-clock-minute`;
  const description = describeBirthTime({ clockHour: Number(clockHour), clockMinute: Number(clockMinute), unknownTime, city, longitude, useTrueSolar, branch });

  return (
    <div className={cn("space-y-3", compact && "space-y-2.5")}>
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">出生时间确定程度</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {([
            { value: 'exact', label: '精确到分钟' },
            ...(allowSegment ? [{ value: 'fuzzy', label: '大概时段' }] : []),
            { value: 'unknown', label: '完全不知道' },
          ] as const).map(mode => (
            <label key={mode.value} className="flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-ink-2">
              <input type="radio" name={`${idPrefix}-time-mode`} value={mode.value} checked={timeMode === mode.value} onChange={() => onTimeModeChange(mode.value as BirthTimeMode)} className="accent-cinnabar" />
              {mode.label}
            </label>
          ))}
        </div>
        {errors.timeMode && <p role="alert" className="text-xs text-cinnabar">{errors.timeMode}</p>}
      </fieldset>
      {timeMode === 'fuzzy' ? <>
        {onSegmentChange && <fieldset className="m-0 min-w-0 space-y-2 rounded-sm border border-line/12 p-3" aria-describedby={`${idPrefix}-segment-note`}>
          <legend className="text-[13px] text-ink-2">选择大概时段</legend>
          {SEGMENTS.map(item => <label key={item.value} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="radio" name={`${idPrefix}-segment`} value={item.value} checked={segment === item.value} aria-invalid={!!errors.segment} onChange={() => onSegmentChange(item.value)} className="accent-cinnabar" />
            {item.label}
          </label>)}
          {errors.segment && <p role="alert" className="text-xs text-cinnabar">{errors.segment}</p>}
        </fieldset>}
        <p id={`${idPrefix}-segment-note`} className="text-xs leading-relaxed text-ink-3">按北京时间选；系统取时段中间时刻，再按出生地校正后排盘。</p>
      </> : <>
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
              value={unknownTime ? "__unknown__" : clockHour}
              onChange={(event) => {
                if (event.target.value !== "__unknown__") onHourChange(event.target.value);
              }}
            >
              {unknownTime && <option value="__unknown__">—</option>}
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
              value={unknownTime ? "__unknown__" : clockMinute}
              onChange={(event) => {
                if (event.target.value !== "__unknown__") onMinuteChange(event.target.value);
              }}
            >
              {unknownTime && <option value="__unknown__">—</option>}
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
              {description.summary}
            </p>
          ) : clockHour === '' || clockMinute === '' ? <p className="text-xs text-ink-3">请选择出生时间，或明确勾选未知。</p> : (
            <div aria-live="polite" className="min-w-0">
              <p className="text-[12px] leading-relaxed text-ink-2">{description.summary}</p>
              {description.detail && <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{description.detail}</p>}
            </div>
          )}
        </div>
      </fieldset>

      {unknownTime && <p className="text-[13px] leading-relaxed text-ink-2">不知道出生时间，以子时（23:00–01:00）起盘</p>}
      </>}
    </div>
  );
}
