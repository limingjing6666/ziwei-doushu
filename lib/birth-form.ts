import type { BirthFormState } from '@/components/BirthForm';
import { leapMonthOfLunarYear, lunarToSolar, solarToLunar } from './ziwei/lunar-solar';
import { isChinaDST } from './ziwei/dst-cn';
import type { FuzzyBirthInput } from './ziwei/fuzzy-time';

export type BirthTimeMode = 'exact' | 'fuzzy' | 'unknown';

export function getBirthTimeMode(form: Partial<BirthFormState>): BirthTimeMode {
  if (form.timeMode === undefined) return form.unknownTime === true ? 'unknown' : 'exact';
  if (form.timeMode !== 'exact' && form.timeMode !== 'fuzzy' && form.timeMode !== 'unknown') {
    throw new Error('出生时间模式无效');
  }
  return form.timeMode;
}

export function normalizeBirthTimeState<T extends Partial<BirthFormState>>(form: T) {
  const timeMode = getBirthTimeMode(form);
  return {
    ...form, timeMode, unknownTime: timeMode === 'unknown',
    segment: form.segment === undefined ? '' as const : form.segment,
    dstApplied: form.dstApplied === undefined ? false : form.dstApplied,
  };
}

export function updateBirthForm(form: BirthFormState, patch: Partial<BirthFormState>): BirthFormState {
  const next = normalizeBirthTimeState({ ...form, ...patch });
  if (['year', 'month', 'day', 'calendar', 'leapMonth'].some(key => key in patch)) next.dstApplied = false;
  return next;
}

export function februaryDays(year: string): number {
  if (!/^\d{4}$/.test(year)) return 29;
  const y = Number(year);
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28;
}

export function hasInvalidFebruaryDay(f: Partial<BirthFormState>): boolean {
  return f.calendar !== 'lunar' && Number(f.month) === 2 && Number(f.day) > februaryDays(f.year ?? '');
}

export function changeBirthDate(form: BirthFormState, patch: { year?: string; month?: string; day?: string }) {
  const next = updateBirthForm(form, patch);
  let dateNotice = '', leapNotice = '';
  if ('year' in patch || 'month' in patch) {
    if (hasInvalidFebruaryDay(next)) {
      next.day = '';
      dateNotice = '原来选择的日期在这个年月不存在，请重新选择“日”';
    }
    const leap = leapMonthOfLunarYear(Number(next.year));
    if (next.calendar === 'lunar' && next.leapMonth && (!leap || leap !== Number(next.month))) {
      next.leapMonth = false;
      leapNotice = '该年该月没有闰月，已取消“闰月”，请核对';
    }
  }
  return { form: next, dateNotice, leapNotice };
}

export function formSolarDate(f: BirthFormState) {
  const y = Number(f.year), m = Number(f.month), d = Number(f.day);
  if (f.calendar === 'lunar') return lunarToSolar(y, m, d, f.leapMonth);
  return solarToLunar(y, m, d) ? { year: y, month: m, day: d } : null;
}
export function validateBirthForm(f: BirthFormState, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  if (f.name && f.name.length > 20) errors.name = '姓名最多20个字，请缩短后再试';
  const minYear = f.calendar === 'lunar' ? 1899 : 1900;
  if (!f.year || !Number.isInteger(Number(f.year)) || Number(f.year) < minYear || Number(f.year) > now.getFullYear()) errors.year = `年份超出范围，请填写公历 1900–${now.getFullYear()} 年${f.calendar === 'lunar' ? '（农历最早 1899 年）' : ''}`;
  if (!f.month) errors.month = '请选择出生月份';
  if (!f.day) errors.day = '请选择出生日期';
  const solar = errors.year ? null : formSolarDate(f);
  if (!errors.year && f.year && f.month && f.day && !solar) errors.day = f.calendar === 'lunar' ? '该农历日期不存在，请检查大小月与闰月' : '该公历日期不存在，请检查月份与日期';
  if (solar && solar.year < 1900) errors.year = '本站受理公历1900年及以后的出生日期';
  if (solar && new Date(solar.year, solar.month - 1, solar.day).getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) errors.day = '出生日期不能是未来日期';
  const timeMode = getBirthTimeMode(f);
  if (timeMode === 'exact' && (f.clockHour === '' || !Number.isInteger(Number(f.clockHour)) || Number(f.clockHour) < 0 || Number(f.clockHour) > 23)) errors.clockHour = '请选择小时，或勾选不知道出生时辰';
  if (timeMode === 'exact' && (f.clockMinute === '' || !Number.isInteger(Number(f.clockMinute)) || Number(f.clockMinute) < 0 || Number(f.clockMinute) > 59)) errors.clockMinute = '请选择分钟';
  if (f.province && !f.city) errors.city = '你已选择省份，请再选择出生城市';
  if (timeMode === 'fuzzy') {
    if (!f.province || !f.city) errors.city = '大概时段必须选择出生省份和城市';
    if (!Number.isFinite(f.longitude)) errors.city = '出生地经度无效，请重新选择城市';
    if (!['00-06', '06-12', '12-18', '18-24'].includes(f.segment ?? '')) errors.segment = '请选择一个大概时段';
    if (typeof f.dstApplied !== 'boolean' && f.dstApplied !== undefined) errors.dstApplied = '夏令时选择无效';
    else if (f.dstApplied && (!solar || !isChinaDST(solar.year, solar.month, solar.day))) errors.dstApplied = '该日期不在夏令时表内，请重新确认';
  }
  if (!f.gender) errors.gender = '请选择性别';
  return errors;
}

export function formToFuzzyBirthInput(form: BirthFormState): FuzzyBirthInput {
  if (getBirthTimeMode(form) !== 'fuzzy' || Object.keys(validateBirthForm(form)).length || !form.gender) {
    throw new Error('请检查大概时段出生信息');
  }
  return {
    dateInfo: formSolarDate(form)!,
    city: { province: form.province, city: form.city, longitude: form.longitude },
    segment: form.segment as FuzzyBirthInput['segment'],
    dstApplied: form.dstApplied === true,
    gender: form.gender,
    name: form.name || undefined,
  };
}

export function isFormReady(form: BirthFormState | null): boolean {
  return !!form && getBirthTimeMode(form) !== 'fuzzy' && Object.keys(validateBirthForm(form)).length === 0;
}
