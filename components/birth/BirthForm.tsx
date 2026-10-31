"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { BirthInfo } from "@/lib/ziwei/types";
import { SHICHEN } from "@/lib/ziwei/constants";
import { PROVINCES } from "@/lib/ziwei/cities";
import { calcTrueSolarBranch } from "@/lib/ziwei/share";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/ui/cn";
import BirthDateFields from "./BirthDateFields";
import BirthLocationFields from "./BirthLocationFields";
import BirthTimeFields from "./BirthTimeFields";
import GenderSegment from "./GenderSegment";
import { BirthStatus, BirthSummary } from "./BirthSummary";
import { isValidDate } from "./birth-utils";

export interface BirthFormState {
  name: string;
  year: string;
  month: string;
  day: string;
  clockHour: string;
  clockMinute: string;
  unknownTime: boolean;
  province: string;
  city: string;
  longitude: number;
  gender: "male" | "female";
}

export type BirthFormVariant = "full" | "compact";

export interface BirthFormProps {
  onSubmit: (info: BirthInfo) => void;
  loading?: boolean;
  initialData?: Partial<BirthFormState>;
  onFormSave?: (data: BirthFormState) => void;
  /** 隐藏内部「排盘」按钮（合盘等场景由父级统一触发） */
  hideSubmit?: boolean;
  /** full：起盘页完整版；compact：合盘页嵌入式紧凑版 */
  variant?: BirthFormVariant;
}

/** 表单分区标题：编号 + 宋体小标题 + 右侧口径提示。 */
function FormSection({
  index,
  title,
  hint,
  compact,
  children,
}: {
  index: string;
  title: string;
  hint?: ReactNode;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn(compact ? "space-y-2.5" : "space-y-3")}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line/12 pb-2">
        <h3 className="flex items-baseline gap-2.5">
          {compact ? null : (
            <span
              aria-hidden="true"
              className="font-mono text-[11px] tracking-[0.08em] text-ink-3"
            >
              {index}
            </span>
          )}
          <span
            className={cn(
              "font-serif font-semibold tracking-[0.01em] text-ink",
              compact ? "text-[14px]" : "text-[15px]",
            )}
          >
            {title}
          </span>
        </h3>
        {hint ? <span className="shrink-0 text-[11px] text-ink-3">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * 出生信息表单。
 *
 * 对外契约保持不变：字段、默认值、校验口径、onSubmit / onFormSave 时机都与旧实现一致，
 * 只重做 UI 与布局（拆成日期 / 时间 / 地点 / 性别 / 摘要子组件）。
 */
export default function BirthForm({
  onSubmit,
  loading = false,
  initialData,
  onFormSave,
  hideSubmit = false,
  variant = "full",
}: BirthFormProps) {
  const compact = variant === "compact";
  const uid = useId();

  const [form, setForm] = useState<BirthFormState>({
    name: initialData?.name ?? "",
    year: initialData?.year ?? "",
    month: initialData?.month ?? "",
    day: initialData?.day ?? "",
    clockHour: initialData?.clockHour ?? "8",
    clockMinute: initialData?.clockMinute ?? "0",
    unknownTime: initialData?.unknownTime ?? false,
    province: initialData?.province ?? "",
    city: initialData?.city ?? "",
    longitude: initialData?.longitude ?? 120,
    gender: initialData?.gender ?? "male",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // 表单状态变化时实时同步给父级（合盘等场景下父级靠这个收集双方数据）
  useEffect(() => {
    onFormSave?.({ ...form });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const branch = useMemo(() => {
    if (form.unknownTime) return 0;
    return calcTrueSolarBranch(
      parseInt(form.clockHour) || 0,
      parseInt(form.clockMinute) || 0,
      form.longitude,
    );
  }, [form.clockHour, form.clockMinute, form.longitude, form.unknownTime]);

  // ─── 校验逻辑（与旧实现一致）────────────────────────────
  const y = parseInt(form.year) || 0;
  const m = parseInt(form.month) || 0;
  const d = parseInt(form.day) || 0;

  const errors = {
    year: !form.year
      ? "请选择出生年份"
      : y < 1900 || y > 2026
        ? "年份范围：1900–2026"
        : "",
    month: !form.month ? "请选择月份" : "",
    day: !form.day
      ? "请选择日期"
      : form.year && form.month && !isValidDate(y, m, d)
        ? `${m}月没有${d}日`
        : "",
  };
  const hasError = Object.values(errors).some(Boolean);

  // ─── 就绪判断（用于状态文字与复核摘要）───────────────────
  const steps = [
    !!form.year &&
      !!form.month &&
      !!form.day &&
      !errors.year &&
      !errors.month &&
      !errors.day,
    !!form.province && !!form.city,
    form.unknownTime || (!!form.clockHour && !!form.clockMinute),
    true, // 性别有默认值
  ];

  // ─── 复核摘要：全部必填完成后显示 ────────────────────────
  const showSummary = steps[0] && steps[2] && !hasError;
  const summaryText = showSummary
    ? [
        `${y}年${m}月${d}日`,
        form.city || (form.province ? form.province : ""),
        form.unknownTime ? "时辰不详" : SHICHEN[branch].name,
        form.gender === "male" ? "男" : "女",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const showErr = (field: string) => Boolean(touched[field] || submitAttempted);
  const dateErrors = {
    year: showErr("year") && errors.year ? errors.year : undefined,
    month: showErr("month") && errors.month ? errors.month : undefined,
    day: showErr("day") && errors.day ? errors.day : undefined,
  };

  // ─── 字段更新 ────────────────────────────────────────────
  const updateForm = (patch: Partial<BirthFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const markTouched = (fields: string[]) => {
    setTouched((prev) => {
      const next = { ...prev };
      for (const field of fields) next[field] = true;
      return next;
    });
  };

  const handleDateChange = (patch: {
    year?: string;
    month?: string;
    day?: string;
  }) => {
    updateForm(patch);
    markTouched(Object.keys(patch));
  };

  const handleProvince = (province: string) => {
    const provinceData = PROVINCES.find((item) => item.name === province);
    const firstCity = provinceData?.cities[0];
    updateForm({
      province,
      city: firstCity?.name || "",
      longitude: firstCity?.longitude ?? 120,
    });
  };

  const handleCity = (city: string) => {
    const provinceData = PROVINCES.find((item) => item.name === form.province);
    const cityData = provinceData?.cities.find((item) => item.name === city);
    updateForm({ city, longitude: cityData?.longitude ?? 120 });
  };

  // ─── 提交 ────────────────────────────────────────────────
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setTouched({ year: true, month: true, day: true });
    if (hasError) return;
    onFormSave?.({ ...form });
    onSubmit({
      year: y,
      month: m,
      day: d,
      hour: branch,
      gender: form.gender,
      name: form.name || undefined,
      province: form.province || undefined,
      city: form.city || undefined,
      longitude: form.province ? form.longitude : undefined,
    });
  };

  const nameId = `${uid}-name`;

  return (
    <form
      onSubmit={handleSubmit}
      // 关闭浏览器原生校验气泡，统一用行内错误提示（role=alert）播报
      noValidate
      aria-busy={loading || undefined}
      className={cn("text-ink", compact ? "space-y-5" : "space-y-7")}
    >
      <FormSection index="01" title="性别与姓名" compact={compact}>
        <div
          className={cn(
            "grid gap-3",
            compact
              ? null
              : "sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-start",
          )}
        >
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium text-ink-2">性别</span>
            <GenderSegment
              name={`${uid}-gender`}
              value={form.gender}
              onChange={(gender) => updateForm({ gender })}
            />
          </div>

          <Field id={nameId} label="姓名" hint="选填">
            <Input
              id={nameId}
              value={form.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="如：张三"
              autoComplete="name"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection index="02" title="出生日期" hint="公历" compact={compact}>
        <BirthDateFields
          idPrefix={uid}
          year={form.year}
          month={form.month}
          day={form.day}
          errors={dateErrors}
          onChange={handleDateChange}
          compact={compact}
        />
      </FormSection>

      <FormSection
        index="03"
        title="出生时间"
        hint="北京时间"
        compact={compact}
      >
        <BirthTimeFields
          idPrefix={uid}
          clockHour={form.clockHour}
          clockMinute={form.clockMinute}
          unknownTime={form.unknownTime}
          branch={branch}
          onHourChange={(clockHour) => updateForm({ clockHour })}
          onMinuteChange={(clockMinute) => updateForm({ clockMinute })}
          onUnknownTimeChange={(unknownTime) => updateForm({ unknownTime })}
          compact={compact}
        />
      </FormSection>

      <FormSection
        index="04"
        title="出生地点"
        hint="经度校正"
        compact={compact}
      >
        <BirthLocationFields
          idPrefix={uid}
          province={form.province}
          city={form.city}
          longitude={form.longitude}
          onProvinceChange={handleProvince}
          onCityChange={handleCity}
          compact={compact}
        />
      </FormSection>

      <FormSection
        index="05"
        title={hideSubmit ? "复核摘要" : "复核与排盘"}
        hint={<BirthStatus ready={showSummary} />}
        compact={compact}
      >
        <div className="space-y-3">
          {showSummary ? (
            <BirthSummary text={summaryText} />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              {compact
                ? "补齐后显示摘要。"
                : "补齐出生日期后即可排盘；出生时间与性别已带默认值，可自行修改。"}
            </p>
          )}

          {hideSubmit ? null : (
            <Button
              type="submit"
              size={compact ? "md" : "lg"}
              className="w-full"
              disabled={loading}
              aria-busy={loading || undefined}
            >
              {loading ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-paper-fixed/40 border-t-paper-fixed"
                  />
                  正在起局…
                </>
              ) : (
                "排盘"
              )}
            </Button>
          )}

          {compact || hideSubmit ? null : (
            <p className="text-center text-[12px] leading-relaxed text-ink-3">
              排盘后可查看十二宫、四化落点与大限，结果仅供文化学习参考。
            </p>
          )}
        </div>
      </FormSection>
    </form>
  );
}
