import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from './types';
import { formSolarDate, validateBirthForm } from '@/lib/birth-form';
import { BRANCHES } from './constants';

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
 * 子时规则（当前表单的换日约定）：
 * · 23:00-23:59 = 晚子时，**按次日**排盘（日期 +1）
 * · 00:00-00:59 = 早子时，按本日排盘
 * 这与「时辰支同为子(0)」并不冲突——子时分早晚两段，需要在日期上区分。
 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  if (Object.keys(validateBirthForm(form)).length || !form.gender) throw new Error('请检查出生信息');
  const solar = formSolarDate(form)!;
  let { year: y, month: m, day: d } = solar;

  // 晚子时（23:00-23:59）按次日处理：用 Date 对象自动处理月末/年末进位
  if (!form.unknownTime) {
    const clockHour = parseInt(form.clockHour) || 0;
    if (clockHour === 23 && y > 0 && m > 0 && d > 0) {
      const next = new Date(y, m - 1, d + 1);
      y = next.getFullYear();
      m = next.getMonth() + 1;
      d = next.getDate();
    }
  }

  const hour = form.unknownTime
    ? 0
    : calcTrueSolarBranch(parseInt(form.clockHour) || 0, parseInt(form.clockMinute) || 0, form.useTrueSolar === false ? 120 : form.longitude);
  return {
    year: y, month: m, day: d,
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

/** BirthFormState → URLSearchParams（用于分享链接） */
export function formToSearchParams(form: BirthFormState): URLSearchParams {
  const p = new URLSearchParams();
  if (form.name) p.set('n', form.name);
  const solar = formSolarDate(form);
  p.set('y', solar ? String(solar.year) : form.year);
  p.set('m', solar ? String(solar.month) : form.month);
  p.set('d', solar ? String(solar.day) : form.day);
  if (form.useTrueSolar === false) p.set('ts', '0');
  if (form.unknownTime) {
    p.set('u', '1');
  } else {
    p.set('h', form.clockHour);
    p.set('mi', form.clockMinute);
  }
  if (form.province) p.set('p', form.province);
  if (form.city) p.set('c', form.city);
  if (form.longitude && form.longitude !== 120) p.set('lo', String(form.longitude));
  p.set('g', form.gender === 'male' ? 'm' : 'f');
  return p;
}

/** URLSearchParams → Partial<BirthFormState>，不完整时返回 null */
export function searchParamsToForm(params: URLSearchParams): Partial<BirthFormState> | null {
  const year = params.get('y');
  const month = params.get('m');
  const day = params.get('d');
  if (!year || !month || !day) return null;
  return {
    name: params.get('n') || '',
    year,
    month,
    day,
    unknownTime: params.get('u') === '1',
    useTrueSolar: params.get('ts') !== '0',
    calendar: 'solar',
    clockHour: params.get('h') || '8',
    clockMinute: params.get('mi') || '0',
    province: params.get('p') || '',
    city: params.get('c') || '',
    longitude: parseFloat(params.get('lo') || '120'),
    gender: params.get('g') === 'f' ? 'female' : 'male',
  };
}
