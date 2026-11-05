import type { BirthFormState } from '@/components/BirthForm';
import type { ZiweiChart } from './ziwei/types';
import { hasInvalidFebruaryDay } from './birth-form';

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
  if (data.form && hasInvalidFebruaryDay(data.form)) {
    return { ...data, form: { ...data.form, day: '' }, dateNotice: '上次填写的日期无效，已清空“日”，请重新选择。' };
  }
  return data;
}
