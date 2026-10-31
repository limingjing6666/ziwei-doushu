'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { BirthInfo } from '@/lib/ziwei/types';
import { PROVINCES } from '@/lib/ziwei/cities';
import { leapMonthOfLunarYear, solarToLunar } from '@/lib/ziwei/lunar-solar';
import { calcTrueSolarBranch, formToBirthInfo } from '@/lib/ziwei/share';
import { formSolarDate, validateBirthForm } from '@/lib/birth-form';
import { isChinaDST } from '@/lib/ziwei/dst-cn';
import { shiftClock } from '@/lib/ziwei/clock-adjust';
import { BRANCHES } from '@/lib/ziwei/constants';

export interface BirthFormState {
  name: string; year: string; month: string; day: string;
  clockHour: string; clockMinute: string; unknownTime: boolean;
  province: string; city: string; longitude: number; gender: 'male' | 'female' | '';
  calendar?: 'solar' | 'lunar'; leapMonth?: boolean; useTrueSolar?: boolean;
}
interface Props {
  onSubmit: (info: BirthInfo) => void; loading?: boolean;
  initialData?: Partial<BirthFormState>; onFormSave?: (data: BirthFormState) => void; hideSubmit?: boolean;
  lateZishiRule?: 'next-day' | 'current-day';
}
export default function BirthForm({ onSubmit, loading, initialData, onFormSave, hideSubmit, lateZishiRule = 'current-day' }: Props) {
  const [form, setForm] = useState<BirthFormState>({ name: '', year: '', month: '', day: '', clockHour: '', clockMinute: '', unknownTime: false,
    province: '', city: '', longitude: 120, gender: '', calendar: 'solar', leapMonth: false, useTrueSolar: true, ...initialData });
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [dstOriginal, setDstOriginal] = useState<{ clockHour: string; clockMinute: string } | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const id = useId();
  useEffect(() => { onFormSave?.(form); }, [form, onFormSave]);
  const update = (patch: Partial<BirthFormState>) => { setForm(f => ({ ...f, ...patch })); setFailure(''); };
  const errors = validateBirthForm(form);
  const solar = formSolarDate(form);
  const lunar = solar && solarToLunar(solar.year, solar.month, solar.day);
  const leap = leapMonthOfLunarYear(Number(form.year));
  const hasTime = !form.unknownTime && form.clockHour !== '' && form.clockMinute !== '';
  const clockBranch = calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), 120);
  const branch = calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), form.useTrueSolar !== false ? form.longitude : 120);
  const changed = hasTime && branch !== clockBranch;
  const cities = PROVINCES.find(p => p.name === form.province)?.cities ?? [];
  const steps = [!!solar && !errors.year && !errors.day, !errors.clockHour && !errors.clockMinute, !!form.gender];
  const switchCalendar = (calendar: 'solar' | 'lunar') => {
    if (calendar === form.calendar) return;
    if (solar && lunar) {
      const v = calendar === 'solar' ? solar : lunar;
      update({ calendar, year: String(v.year), month: String(v.month), day: String(v.day), leapMonth: calendar === 'lunar' && lunar.leapMonth });
    } else update({ calendar, leapMonth: false });
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setAttempted(true);
    const first = Object.keys(errors)[0];
    if (first) {
      const el = ref.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus(); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    if (busy || loading) return;
    setBusy(true);
    // Yield a paint before synchronous local chart computation.
    await new Promise(resolve => setTimeout(resolve, 32));
    try { onSubmit(formToBirthInfo(form, lateZishiRule)); }
    catch { setFailure('排盘未完成，请检查出生信息后重试'); }
    finally { setBusy(false); }
  };
  const field = (name: keyof BirthFormState, label: string, options?: number[]) => (
    <label className="birth-field" htmlFor={`${id}-${name}`}>
      <span>{label}</span>
      {options ? <select id={`${id}-${name}`} name={name} value={String(form[name] ?? '')} disabled={form.unknownTime && (name === 'clockHour' || name === 'clockMinute')}
        aria-invalid={attempted && !!errors[name]} onChange={e => update({ [name]: e.target.value, ...(name === 'month' ? { leapMonth: false } : {}) })}>
        <option value="">{label}</option>{options.map(n => <option key={n} value={n}>{n}</option>)}
      </select> : <input id={`${id}-${name}`} name={name} type="number" inputMode="numeric" placeholder="如 1990" min={form.calendar === 'lunar' ? 1899 : 1900} max={new Date().getFullYear()}
        value={String(form[name] ?? '')} aria-invalid={attempted && !!errors[name]} onChange={e => update({ [name]: e.target.value, leapMonth: false })} />}
      {attempted && errors[name] && <span className="field-error">{errors[name]}</span>}
    </label>
  );
  return <form ref={ref} onSubmit={submit} noValidate className="birth-form card-glass rounded-2xl p-4 sm:p-7">
    <h2 className="text-center mb-4" style={{ color: 'var(--ac)' }}>填写出生信息</h2>
    <div className="flex gap-1 mb-5" aria-label={`必填项已完成 ${steps.filter(Boolean).length}/3`}>{steps.map((done, i) => <div key={i} className="h-1 flex-1 rounded" style={{ background: done ? 'var(--ac)' : 'var(--bdr-heavy)' }} />)}</div>
    <label className="birth-field">称呼（选填）<input value={form.name} onChange={e => update({ name: e.target.value })} placeholder="可不填写" /></label>
    <div className="flex gap-2 my-4" aria-label="历法">{(['solar', 'lunar'] as const).map(v => <button key={v} type="button" aria-pressed={form.calendar === v} onClick={() => switchCalendar(v)} className={form.calendar === v ? 'ux-button active' : 'ux-button'}>{v === 'solar' ? '公历' : '农历'}</button>)}</div>
    <p className="text-sm mb-2">出生日期（必填 · {form.calendar === 'lunar' ? '农历年份' : '公历'}）</p>
    <div className="birth-date-grid">{field('year', '年份')}{field('month', '月份', Array.from({ length: 12 }, (_, i) => i + 1))}{field('day', '日期', Array.from({ length: form.calendar === 'lunar' ? 30 : 31 }, (_, i) => i + 1))}</div>
    {form.calendar === 'lunar' && <label className="block text-sm my-2"><input type="checkbox" checked={!!form.leapMonth} disabled={!leap || Number(form.month) !== leap} onChange={e => update({ leapMonth: e.target.checked })} /> 闰月 <span className="text-xs">{leap ? `该年闰${leap}月，仅选该月可勾选` : '该年没有闰月'}</span></label>}
    {solar && lunar && <p className="calendar-conversion text-sm my-3" role="status" style={{ color: 'var(--ac)' }}>公历 {solar.year}-{String(solar.month).padStart(2, '0')}-{String(solar.day).padStart(2, '0')} ＝ {lunar.label}</p>}
    {!solar && form.year && form.month && form.day && <p className="field-error">{errors.day}</p>}
    <p className="text-sm mt-5 mb-2">出生时间（必填 · 北京时间 / 东八区）</p>
    <label className="block text-sm mb-3"><input type="checkbox" checked={form.unknownTime} onChange={e => update({ unknownTime: e.target.checked })} /> 不知道出生时辰</label>
    {form.unknownTime && <p className="ux-notice mb-3">时辰未知时命宫、身宫和各宫排布不可靠，结果仅供参考。暂用子时占位。</p>}
    <div className="grid grid-cols-2 gap-3">{field('clockHour', '小时', Array.from({ length: 24 }, (_, i) => i))}{field('clockMinute', '分钟', Array.from({ length: 60 }, (_, i) => i))}</div>
    <fieldset className="my-5"><legend className="text-sm mb-2">校时方式</legend><div className="flex flex-wrap gap-3 text-sm">
      <label><input type="radio" name={`${id}-solar`} checked={form.useTrueSolar !== false} onChange={() => update({ useTrueSolar: true })} /> 按真太阳时（默认）</label>
      <label><input type="radio" name={`${id}-solar`} checked={form.useTrueSolar === false} onChange={() => update({ useTrueSolar: false })} /> 按钟表时间</label>
    </div><p className="text-xs my-2" style={{ color: 'var(--tx-2)' }}>出生地用于真太阳时校正，影响时辰判断；不确定可选「按钟表时间」。本表沿用经度校正口径，未选地点不作偏移。</p>
    <div className="birth-location-grid"><label className="birth-field">省份<select value={form.province} disabled={form.useTrueSolar === false} onChange={e => { const p = PROVINCES.find(p => p.name === e.target.value); const c = p?.cities[0]; update({ province: e.target.value, city: c?.name ?? '', longitude: c?.longitude ?? 120 }); }}><option value="">选择省份</option>{PROVINCES.map(p => <option key={p.name}>{p.name}</option>)}</select></label>
    <label className="birth-field">城市<select value={form.city} disabled={!form.province || form.useTrueSolar === false} onChange={e => update({ city: e.target.value, longitude: cities.find(c => c.name === e.target.value)?.longitude ?? 120 })}><option value="">选择城市</option>{cities.map(c => <option key={c.name}>{c.name}</option>)}</select></label></div>
    {hasTime && <p className="text-sm mt-2">当前：{BRANCHES[branch]}时{form.useTrueSolar !== false ? '（经度校正）' : '（钟表时间）'}</p>}
    {changed && <p className="ux-notice mt-2">按真太阳时校正后，出生时辰由「{BRANCHES[clockBranch]}时」变为「{BRANCHES[branch]}时」。<button type="button" className="underline" onClick={() => update({ useTrueSolar: false })}>改按钟表时间</button></p>}
    </fieldset>
    {hasTime && Number(form.clockHour) === 23 && <p className="ux-notice my-3">23 点后属晚子时，不同流派对日柱有不同算法；本页沿用原设置，23 点至 24 点按{lateZishiRule === 'next-day' ? '次日' : '本日'}排盘，0 点至 1 点按本日处理。</p>}
    {solar && isChinaDST(solar.year, solar.month, solar.day) && <div className="ux-notice my-3">该时段中国实行过夏令时，出生时间是否为夏令时钟表时间？默认不自动调整；若已换算为标准时间，无需操作。
      <button type="button" className="ux-button mt-2" disabled={!dstOriginal && !shiftClock(form, -60)} onClick={() => { if (dstOriginal) { update(dstOriginal); setDstOriginal(null); } else { const shifted = shiftClock(form, -60); if (shifted) { setDstOriginal({ clockHour: form.clockHour, clockMinute: form.clockMinute }); update(shifted); } } }}>{dstOriginal ? '撤销减 1 小时' : '这是夏令时读数，减 1 小时'}</button><p className="text-xs">若调整会跨日，请自行核对日期后手动修改。</p></div>}
    <fieldset className="my-5"><legend className="text-sm mb-2">性别（必填 · 用于运限顺逆）</legend><div className="flex gap-3">{(['male', 'female'] as const).map(g => <button type="button" name="gender" key={g} className={form.gender === g ? 'ux-button active flex-1' : 'ux-button flex-1'} aria-pressed={form.gender === g} onClick={() => update({ gender: g })}>{g === 'male' ? '男' : '女'}</button>)}</div>{attempted && errors.gender && <p className="field-error">{errors.gender}</p>}</fieldset>
    {failure && <p role="alert" className="field-error">{failure}</p>}
    {!hideSubmit && <button type="submit" className="ux-primary w-full" disabled={busy || loading}>{busy || loading ? '正在排盘…' : '开始排盘'}</button>}
    {(busy || loading) && <p role="status" className="ux-notice mt-3 animate-pulse">正在整理十二宫与命盘摘要…</p>}
  </form>;
}
