import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from './types';
import { formSolarDate, getBirthTimeMode, normalizeBirthTimeState, validateBirthForm } from '@/lib/birth-form';
import { BRANCHES } from './constants';
import { shiftGregorianDate } from './true-solar-time';
import { solarToLunar } from './lunar-solar';

/** 根据北京时间 + 经度计算真太阳时时辰支 (0-11) */
export function calcTrueSolarBranch(clockHour: number, clockMinute: number, longitude: number): number {
  const clockMins = clockHour * 60 + clockMinute;
  const offset = (longitude - 120) * 4;
  const solar = ((clockMins + offset) % 1440 + 1440) % 1440;
  if (solar >= 1380 || solar < 60) return 0;
  return Math.floor((solar - 60) / 120) + 1;
}

/** BirthFormState → BirthInfo
 *
 * 按所选校时方式处理后的未取模分钟数求时辰与排盘日，23:00 起归下一排盘日。
 * 精确时分已由夏令时按钮处理，不再读取 dstApplied；未知时辰保留填写日与子时占位。
 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  if (getBirthTimeMode(form) === 'fuzzy') throw new Error('大概时段不能转换为单张命盘');
  form = normalizeBirthTimeState(form);
  if (Object.keys(validateBirthForm(form)).length || !form.gender) throw new Error('请检查出生信息');
  const solar = formSolarDate(form)!;
  let chartDate = solar;
  let hour = 0;
  if (!form.unknownTime) {
    const r = Number(form.clockHour) * 60 + Number(form.clockMinute)
      + (form.useTrueSolar === false ? 0 : (form.longitude - 120) * 4);
    const k = Math.floor((r + 60) / 120);
    if (!Number.isSafeInteger(k)) throw new RangeError('出生时间校正范围非法');
    hour = ((k % 12) + 12) % 12;
    chartDate = shiftGregorianDate(solar, Math.floor(k / 12));
    if (!solarToLunar(chartDate.year, chartDate.month, chartDate.day)) {
      throw new RangeError('排盘日期超出支持范围');
    }
  }

  return {
    ...chartDate,
    hour,
    gender: form.gender,
    birthTimeKnown: !form.unknownTime,
    timeCorrectionNotice: !form.unknownTime && hour !== calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), 120)
      ? `按真太阳时校正后，出生时辰由「${BRANCHES[calcTrueSolarBranch(Number(form.clockHour), Number(form.clockMinute), 120)]}时」变为「${BRANCHES[hour]}时」` : undefined,
    origInput: form.unknownTime ? undefined : { ...solar, clockHour: Number(form.clockHour), clockMinute: Number(form.clockMinute) },
    name: form.name || undefined,
    province: form.province || undefined,
    city: form.city || undefined,
    longitude: form.province ? form.longitude : undefined,
  };
}
