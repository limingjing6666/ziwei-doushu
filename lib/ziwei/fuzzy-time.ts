export const SEGMENTS = [
  { value: '00-06', label: '凌晨（0 点–6 点）', start: 0, end: 360 },
  { value: '06-12', label: '上午（6 点–12 点）', start: 360, end: 720 },
  { value: '12-18', label: '下午（12 点–18 点）', start: 720, end: 1080 },
  { value: '18-24', label: '晚上（18 点–24 点）', start: 1080, end: 1440 },
] as const;

export type Segment = typeof SEGMENTS[number]['value'];

export function representativeClock(segment: Segment, dstApplied: boolean) {
  const range = SEGMENTS.find(item => item.value === segment);
  if (!range) throw new RangeError('请选择有效的大概时段');
  const minutes = (range.start + range.end) / 2 - (dstApplied ? 60 : 0);
  return { clockHour: Math.floor(minutes / 60), clockMinute: minutes % 60, label: range.label.split('（')[0] };
}
