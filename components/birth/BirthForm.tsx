"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { BirthInfo } from "@/lib/ziwei/types";
import { SHICHEN } from "@/lib/ziwei/constants";
import { PROVINCES } from "@/lib/ziwei/cities";
import { formSolarDate, validateBirthForm } from '@/lib/birth-form';
import { solarToLunar, leapMonthOfLunarYear } from '@/lib/ziwei/lunar-solar';
import { isChinaDST } from '@/lib/ziwei/dst-cn';
import { shiftClock } from '@/lib/ziwei/clock-adjust';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { calcTrueSolarBranch, formToBirthInfo } from "@/lib/ziwei/share";
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
  gender: "male" | "female" | "";
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  useTrueSolar?: boolean;
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
  lateZishiRule?: 'next-day' | 'current-day';
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
 * 保留 #9 的分区和字段组件，使用 #8 共用校验与双历转换。
 * 年月日、时分、性别默认空白；未知时辰须显式选择。
 */
export default function BirthForm({
  onSubmit,
  loading = false,
  initialData,
  onFormSave,
  hideSubmit = false,
  variant = "full",
  lateZishiRule = 'current-day',
}: BirthFormProps) {
  const compact = variant === "compact";
  const uid = useId();

  const [form, setForm] = useState<BirthFormState>({
    name: initialData?.name ?? "",
    year: initialData?.year ?? "",
    month: initialData?.month ?? "",
    day: initialData?.day ?? "",
    clockHour: initialData?.clockHour ?? "",
    clockMinute: initialData?.clockMinute ?? "",
    unknownTime: initialData?.unknownTime ?? false,
    province: initialData?.province ?? "",
    city: initialData?.city ?? "",
    longitude: initialData?.longitude ?? 120,
    gender: initialData?.gender ?? "",
    calendar: initialData?.calendar ?? 'solar',
    leapMonth: initialData?.leapMonth ?? false,
    useTrueSolar: initialData?.useTrueSolar ?? true,
  });

  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [dstOriginal, setDstOriginal] = useState<{ clockHour: string; clockMinute: string } | null>(null);
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
      form.useTrueSolar === false ? 120 : form.longitude,
    );
  }, [form.clockHour, form.clockMinute, form.longitude, form.unknownTime, form.useTrueSolar]);

  // ─── 校验逻辑（与旧实现一致）────────────────────────────
  const y = parseInt(form.year) || 0;
  const m = parseInt(form.month) || 0;
  const d = parseInt(form.day) || 0;

  const errors = validateBirthForm(form);
  // 保留 #9 的实际日数校验，并加入未来日期、时间和性别校验。
  if (form.calendar !== 'lunar' && y && m && d && !isValidDate(y, m, d)) errors.day = `${m}月没有${d}日`;
  const solar = formSolarDate(form);
  const lunar = solar && solarToLunar(solar.year, solar.month, solar.day);
  const leap = leapMonthOfLunarYear(y);
  const switchCalendar = (calendar: 'solar' | 'lunar') => {
    if (calendar === form.calendar) return;
    const date = calendar === 'solar' ? solar : lunar;
    updateForm(date ? { calendar, year: String(date.year), month: String(date.month), day: String(date.day), leapMonth: calendar === 'lunar' && !!lunar?.leapMonth } : { calendar, leapMonth: false });
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
    !!form.gender,
  ];

  // ─── 复核摘要：全部必填完成后显示 ────────────────────────
  const showSummary = steps[0] && steps[2] && steps[3] && !hasError;
  const summaryText = showSummary
    ? [
        `${form.calendar === 'lunar' ? '农历' : '公历'} ${y}年${m}月${d}日`,
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
    setFailure('');
    if (['year', 'month', 'day', 'calendar', 'clockHour', 'clockMinute'].some(key => key in patch)) setDstOriginal(null);
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
    updateForm({ ...patch, ...(('month' in patch || 'year' in patch) ? { leapMonth: false } : {}) });
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
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (hasError) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (loading || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    await new Promise(resolve => setTimeout(resolve, 32));
    try {
      onFormSave?.({ ...form });
      onSubmit(formToBirthInfo(form, lateZishiRule));
    } catch { setFailure('排盘未完成，请检查出生信息后重试'); }
    finally { submitting.current = false; setBusy(false); }
  };

  const nameId = `${uid}-name`;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // 关闭浏览器原生校验气泡，统一用行内错误提示（role=alert）播报
      noValidate
      aria-busy={loading || busy || undefined}
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
            {submitAttempted && errors.gender && <p role="alert" className="text-xs text-cinnabar">{errors.gender}</p>}
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

      <FormSection index="02" title="出生日期" compact={compact}>
        <SegmentedControl<'solar' | 'lunar'> ariaLabel="历法" options={[{ value: 'solar', label: '公历' }, { value: 'lunar', label: '农历' }]} value={form.calendar ?? 'solar'} onChange={switchCalendar} />
        <BirthDateFields
          idPrefix={uid}
          year={form.year}
          month={form.month}
          day={form.day}
          errors={dateErrors}
          onChange={handleDateChange}
          compact={compact}
          lunar={form.calendar === 'lunar'}
        />
        {form.calendar === 'lunar' && <label className="block text-sm text-ink-2"><input type="checkbox" checked={!!form.leapMonth} disabled={!leap || m !== leap} onChange={e => updateForm({ leapMonth: e.target.checked })} /> 闰月 · {leap ? `该年闰${leap}月，仅选该月可勾选` : '该年没有闰月'}</label>}
        {solar && lunar && <p role="status" className="text-sm text-cinnabar">公历 {solar.year}-{String(solar.month).padStart(2, '0')}-{String(solar.day).padStart(2, '0')} ＝ {lunar.label}</p>}
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
          errors={submitAttempted ? errors : {}}
          useTrueSolar={form.useTrueSolar !== false}
        />
        {!form.unknownTime && form.clockHour === '23' && <p className="ux-notice">23 点至 24 点属晚子时，本页按{lateZishiRule === 'next-day' ? '次日' : '本日'}排盘；0 点至 1 点按本日处理。</p>}
        {solar && isChinaDST(solar.year, solar.month, solar.day) && <div className="ux-notice">该时段中国实行过夏令时。默认不自动调整；已换算为标准时间则无需操作。
          <Button variant="secondary" size="sm" disabled={form.unknownTime || (!dstOriginal && !shiftClock(form, -60))} onClick={() => {
            if (dstOriginal) { setForm(f => ({ ...f, ...dstOriginal })); setDstOriginal(null); }
            else { const shifted = shiftClock(form, -60); if (shifted) { setDstOriginal({ clockHour: form.clockHour, clockMinute: form.clockMinute }); setForm(f => ({ ...f, ...shifted })); } }
          }}>{dstOriginal ? '撤销减 1 小时' : '这是夏令时读数，减 1 小时'}</Button><p>若调整会跨日，请自行核对日期后手动修改。</p>
        </div>}
      </FormSection>

      <FormSection
        index="04"
        title="出生地点"
        hint="经度校正"
        compact={compact}
      >
        <SegmentedControl<'solar' | 'clock'> ariaLabel="校时方式" options={[{ value: 'solar', label: '按真太阳时' }, { value: 'clock', label: '按钟表时间' }]} value={form.useTrueSolar === false ? 'clock' : 'solar'} onChange={v => updateForm({ useTrueSolar: v === 'solar' })} />
        <p className="text-xs text-ink-3">真太阳时是按出生地经度校正的当地太阳时间；经度每差 1° 约差 4 分钟，可能改变时辰，所以需要出生城市。不选地点不作偏移。</p>
        {!form.unknownTime && form.clockHour !== '' && form.clockMinute !== '' && branch !== calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), 120) && <p className="ux-notice">按真太阳时校正后，时辰由{SHICHEN[calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), 120)].name}变为{SHICHEN[branch].name}。<Button variant="quiet" onClick={() => updateForm({ useTrueSolar: false })}>改按钟表时间</Button></p>}
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
                : "请补齐出生日期、时间与性别；不确定时辰可勾选未知。"}
            </p>
          )}

          {failure && <p role="alert" className="text-sm text-cinnabar">{failure}</p>}
          {hideSubmit ? null : (
            <Button
              type="submit"
              size={compact ? "md" : "lg"}
              className="w-full"
              disabled={loading || busy}
              aria-busy={loading || busy || undefined}
            >
              {loading || busy ? (
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
