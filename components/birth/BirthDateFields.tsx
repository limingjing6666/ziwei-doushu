"use client";

import { Field, Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/ui/cn";
import { DAY_OPTIONS, MONTH_OPTIONS } from "./birth-utils";

export interface BirthDateErrors {
  year?: string;
  month?: string;
  day?: string;
}

export default function BirthDateFields({
  idPrefix,
  year,
  month,
  day,
  errors,
  onChange,
  compact = false,
  lunar = false,
}: {
  idPrefix: string;
  year: string;
  month: string;
  day: string;
  errors: BirthDateErrors;
  onChange: (patch: { year?: string; month?: string; day?: string }) => void;
  compact?: boolean;
  lunar?: boolean;
}) {
  const yearId = `${idPrefix}-year`;
  const monthId = `${idPrefix}-month`;
  const dayId = `${idPrefix}-day`;

  // 错误文案由 ui/Field 渲染为 `${id}-error`，这里通过 aria-describedby 关联。
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">出生日期</legend>
      <div
        className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-2 sm:gap-3")}
      >
        <Field id={yearId} label="年" error={errors.year}>
          <Input id={yearId} type="number" inputMode="numeric" placeholder="如 1990" min={lunar ? 1899 : 1900} max={new Date().getFullYear()} value={year} required invalid={Boolean(errors.year)} aria-describedby={errors.year ? `${yearId}-error` : undefined} onChange={event => onChange({ year: event.target.value })} className="min-w-0 px-2" />
        </Field>

        <Field id={monthId} label="月" error={errors.month}>
          <Select
            id={monthId}
            value={month}
            required
            invalid={Boolean(errors.month)}
            aria-describedby={errors.month ? `${monthId}-error` : undefined}
            onChange={(event) => onChange({ month: event.target.value })}
          >
            <option value="">月份</option>
            {MONTH_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                {option} 月
              </option>
            ))}
          </Select>
        </Field>

        <Field id={dayId} label="日" error={errors.day}>
          <Select
            id={dayId}
            value={day}
            required
            invalid={Boolean(errors.day)}
            aria-describedby={errors.day ? `${dayId}-error` : undefined}
            onChange={(event) => onChange({ day: event.target.value })}
          >
            <option value="">日期</option>
            {DAY_OPTIONS.filter(day => !lunar || day <= 30).map((option) => (
              <option key={option} value={String(option)}>
                {option} 日
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </fieldset>
  );
}
