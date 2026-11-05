import { SHICHEN } from './ziwei/constants';
import { calcTrueSolarBranch } from './ziwei/share';

/** 仅展示经度校时；分钟向下取整，时辰沿用原始精度，不参与排盘。 */
export function describeBirthTime(input: {
  clockHour?: number;
  clockMinute?: number;
  unknownTime?: boolean;
  city?: string;
  longitude?: number;
  useTrueSolar?: boolean;
  branch: number;
}): { summary: string; detail?: string } {
  if (input.unknownTime) return { summary: '出生时间不详，按子时占位；没有可校正的出生时刻。' };
  const shichen = SHICHEN[input.branch].name;
  if (input.useTrueSolar === undefined || input.clockHour === undefined || input.clockMinute === undefined) return { summary: `${shichen}（旧记录未保存校时方式）` };
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(input.clockHour)}:${pad(input.clockMinute)} 北京时间`;
  if (!input.city) return { summary: `${clock} → ${shichen}（未填写出生地，未作地点校正）` };
  if (!input.useTrueSolar) return { summary: `${clock} → ${shichen}（未作地点校正）` };
  const offset = (input.longitude! - 120) * 4;
  const raw = input.clockHour * 60 + input.clockMinute + offset;
  const minutes = Math.floor(((raw % 1440) + 1440) % 1440);
  const branch = calcTrueSolarBranch(input.clockHour, input.clockMinute, input.longitude!);
  const difference = offset === 0 ? '与北京时间相同' : `比北京时间${offset < 0 ? '慢' : '快'}约${Math.round(Math.abs(offset))}分钟`;
  const midnight = raw < 0 ? '校正后落在前一天；本次仍按你填写的日期排盘。' : raw >= 1440 ? '校正后落在后一天；本次仍按你填写的日期排盘。' : '';
  return {
    summary: `${clock} → 校正后 ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)} → ${SHICHEN[branch].name}`,
    detail: `仅按出生城市经度校正，${difference}。${midnight}`,
  };
}
