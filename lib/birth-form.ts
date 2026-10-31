import type { BirthFormState } from '@/components/BirthForm';
import { lunarToSolar, solarToLunar } from './ziwei/lunar-solar';

export function formSolarDate(f: BirthFormState) {
  const y = Number(f.year), m = Number(f.month), d = Number(f.day);
  if (f.calendar === 'lunar') return lunarToSolar(y, m, d, f.leapMonth);
  return solarToLunar(y, m, d) ? { year: y, month: m, day: d } : null;
}
export function validateBirthForm(f: BirthFormState, now = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  const minYear = f.calendar === 'lunar' ? 1899 : 1900;
  if (!f.year || !Number.isInteger(Number(f.year)) || Number(f.year) < minYear || Number(f.year) > now.getFullYear()) errors.year = `请填写出生年份（公历1900–${now.getFullYear()}，年初可能对应农历1899年）`;
  if (!f.month) errors.month = '请选择出生月份';
  if (!f.day) errors.day = '请选择出生日期';
  const solar = formSolarDate(f);
  if (f.year && f.month && f.day && !solar) errors.day = f.calendar === 'lunar' ? '该农历日期不存在，请检查大小月与闰月' : '该公历日期不存在，请检查月份与日期';
  if (solar && solar.year < 1900) errors.year = '本站受理公历1900年及以后的出生日期';
  if (solar && new Date(solar.year, solar.month - 1, solar.day).getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) errors.day = '出生日期不能是未来日期';
  if (!f.unknownTime && f.clockHour === '') errors.clockHour = '请选择小时，或勾选不知道出生时辰';
  if (!f.unknownTime && f.clockMinute === '') errors.clockMinute = '请选择分钟';
  if (!f.gender) errors.gender = '请选择性别';
  return errors;
}
