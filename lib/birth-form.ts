import type { BirthFormState } from '@/components/BirthForm';
import { leapMonthOfLunarYear, lunarToSolar, solarToLunar } from './ziwei/lunar-solar';

export function februaryDays(year: string): number {
  if (!/^\d{4}$/.test(year)) return 29;
  const y = Number(year);
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28;
}

export function hasInvalidFebruaryDay(f: Partial<BirthFormState>): boolean {
  return f.calendar !== 'lunar' && Number(f.month) === 2 && Number(f.day) > februaryDays(f.year ?? '');
}

export function changeBirthDate(form: BirthFormState, patch: { year?: string; month?: string; day?: string }) {
  const next = { ...form, ...patch };
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
  const minYear = f.calendar === 'lunar' ? 1899 : 1900;
  if (!f.year || !Number.isInteger(Number(f.year)) || Number(f.year) < minYear || Number(f.year) > now.getFullYear()) errors.year = `年份超出范围，请填写公历 1900–${now.getFullYear()} 年${f.calendar === 'lunar' ? '（农历最早 1899 年）' : ''}`;
  if (!f.month) errors.month = '请选择出生月份';
  if (!f.day) errors.day = '请选择出生日期';
  const solar = errors.year ? null : formSolarDate(f);
  if (!errors.year && f.year && f.month && f.day && !solar) errors.day = f.calendar === 'lunar' ? '该农历日期不存在，请检查大小月与闰月' : '该公历日期不存在，请检查月份与日期';
  if (solar && solar.year < 1900) errors.year = '本站受理公历1900年及以后的出生日期';
  if (solar && new Date(solar.year, solar.month - 1, solar.day).getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) errors.day = '出生日期不能是未来日期';
  if (!f.unknownTime && (f.clockHour === '' || !Number.isInteger(Number(f.clockHour)) || Number(f.clockHour) < 0 || Number(f.clockHour) > 23)) errors.clockHour = '请选择小时，或勾选不知道出生时辰';
  if (!f.unknownTime && (f.clockMinute === '' || !Number.isInteger(Number(f.clockMinute)) || Number(f.clockMinute) < 0 || Number(f.clockMinute) > 59)) errors.clockMinute = '请选择分钟';
  if (f.province && !f.city) errors.city = '你已选择省份，请再选择出生城市';
  if (!f.gender) errors.gender = '请选择性别';
  return errors;
}
