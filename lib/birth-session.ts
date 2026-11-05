import type { BirthFormState } from '@/components/BirthForm';
import type { ZiweiChart } from './ziwei/types';
import { hasInvalidFebruaryDay, normalizeBirthTimeState, updateBirthForm } from './birth-form';

interface BirthSession {
  form?: BirthFormState;
  chart: ZiweiChart | null;
  useTrueSolar?: boolean;
  dateNotice?: string;
}

export function restoreBirthSession(saved: string): BirthSession {
  let data: BirthSession;
  try {
    data = JSON.parse(saved);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { chart: null };
  }
  if (data.form) data = { ...data, form: normalizeBirthTimeState(data.form) };
  if (data.form && hasInvalidFebruaryDay(data.form)) {
    data = { ...data, form: updateBirthForm(data.form, { day: '' }), dateNotice: '上次填写的日期无效，已清空“日”，请重新选择。' };
  }
  if (data.form?.timeMode === 'fuzzy' && !data.chart?.birthInfo?.timeBasis) {
    data = { ...data, chart: null };
  }
  return data;
}

export function serializeBirthSession(data: BirthSession): string {
  const form = data.form ? normalizeBirthTimeState(data.form) : undefined;
  return JSON.stringify({ form, chart: data.chart, useTrueSolar: data.useTrueSolar });
}
