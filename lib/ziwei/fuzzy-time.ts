import { generateChart } from './algorithm';
import { compareCandidates } from './compare-candidates';
import { isChinaDST } from './dst-cn';
import { isValidGregorianDate, shiftGregorianDate, type GregorianDate } from './true-solar-time';
import type { BirthInfo, ZiweiChart } from './types';

export const SEGMENTS = [
  { value: '00-06', label: '凌晨（0 点–6 点）', start: 0, end: 360 },
  { value: '06-12', label: '上午（6 点–12 点）', start: 360, end: 720 },
  { value: '12-18', label: '下午（12 点–18 点）', start: 720, end: 1080 },
  { value: '18-24', label: '晚上（18 点–24 点）', start: 1080, end: 1440 },
] as const;

export type Segment = typeof SEGMENTS[number]['value'];
export type Branch = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type FuzzyCity = Readonly<{ province: string; city: string; longitude: number }>;
export type FuzzyBirthInput = Readonly<{
  dateInfo: Readonly<GregorianDate>; // 已经由表单转换一次的公历输入日
  city: FuzzyCity;
  segment: Segment;
  dstApplied: boolean;
  gender: BirthInfo['gender'];
  name?: string;
}>;

export type CandidateBranch = Readonly<{
  id: string; // YYYY-MM-DD|branch，不能只按地支去重
  chartDate: Readonly<GregorianDate>;
  branch: Branch;
  clockRanges: readonly (readonly [number, number])[]; // 原始钟表分钟，半开区间
}>;
export type Candidate = CandidateBranch & Readonly<{ chart: ZiweiChart }>;
export type FuzzyContext = FuzzyBirthInput & Readonly<{
  evaluatedAt: string;
  evaluatedDate: Readonly<GregorianDate>; // 与引擎一致的本地评估日期
}>;
export type ChartResult =
  | Readonly<{ kind: 'single'; chart: ZiweiChart; candidates?: never; context?: never }>
  | Readonly<{ kind: 'candidates'; candidates: readonly Candidate[]; context: FuzzyContext; chart?: never }>;

function dateKey(date: Readonly<GregorianDate>): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

export function enumerateCandidateBranches(
  dateInfo: Readonly<GregorianDate>,
  city: FuzzyCity,
  segment: Segment,
  dstApplied: boolean,
): readonly CandidateBranch[] {
  if (!dateInfo || !isValidGregorianDate(dateInfo.year, dateInfo.month, dateInfo.day)) {
    throw new RangeError('出生公历日期不存在');
  }
  if (!city || typeof city.province !== 'string' || !city.province.trim()
    || typeof city.city !== 'string' || !city.city.trim()) {
    throw new Error('请选择出生省份和城市');
  }
  if (!Number.isFinite(city.longitude)) throw new RangeError('出生地经度非法');
  const range = SEGMENTS.find(item => item.value === segment);
  if (!range) throw new RangeError('请选择有效的大概时段');
  if (typeof dstApplied !== 'boolean') throw new TypeError('夏令时选择非法');
  if (dstApplied && !isChinaDST(dateInfo.year, dateInfo.month, dateInfo.day)) {
    throw new Error('该日期不在夏令时表内，请重新确认');
  }

  const delta = (dstApplied ? -60 : 0) + (city.longitude - 120) * 4;
  const A = range.start + delta;
  const B = range.end + delta;
  let k = Math.floor((A + 60) / 120);
  if (!Number.isSafeInteger(k) || !Number.isFinite(B) || !(A < B)) {
    throw new RangeError('时段校正范围非法');
  }
  const byId = new Map<string, CandidateBranch>();
  // 不取模、不舍入端点；子时格从校正后的 23:00 起归下一排盘日。
  for (; 120 * k - 60 < B; k++) {
    const lo = Math.max(A, 120 * k - 60);
    const hi = Math.min(B, 120 * k + 60);
    if (lo >= hi) continue;
    const branch = ((k % 12 + 12) % 12) as Branch;
    const chartDate = shiftGregorianDate(dateInfo, Math.floor(k / 12));
    if (!isValidGregorianDate(chartDate.year, chartDate.month, chartDate.day)) {
      throw new RangeError('候选排盘日期不存在');
    }
    const id = `${dateKey(chartDate)}|${branch}`;
    const clockRange = [lo - delta, hi - delta] as const;
    const previous = byId.get(id);
    byId.set(id, {
      id, chartDate, branch,
      clockRanges: previous ? [...previous.clockRanges, clockRange] : [clockRange],
    });
  }
  const candidates = [...byId.values()];
  if (candidates.length !== 3 && candidates.length !== 4) {
    throw new Error('未能完整生成候选');
  }
  return candidates;
}

export function buildCandidateResult(
  input: FuzzyBirthInput,
  evaluatedAt: Date,
): Extract<ChartResult, { kind: 'candidates' }> {
  if (!(evaluatedAt instanceof Date) || !Number.isFinite(evaluatedAt.getTime())) {
    throw new RangeError('评估时刻非法');
  }
  if (input.gender !== 'male' && input.gender !== 'female') throw new Error('请选择性别');
  const branches = enumerateCandidateBranches(input.dateInfo, input.city, input.segment, input.dstApplied);
  const candidates: readonly Candidate[] = branches.map(candidate => ({
    ...candidate,
    chart: generateChart({
      ...candidate.chartDate,
      hour: candidate.branch,
      gender: input.gender,
      name: input.name,
      province: input.city.province,
      city: input.city.city,
      longitude: input.city.longitude,
      birthTimeKnown: true,
    }, { evaluatedAt }),
  }));
  // 先生成全部盘，再逐字段校验整批；任一失败都不返回部分结果。
  compareCandidates(candidates);
  return {
    kind: 'candidates',
    candidates,
    context: {
      dateInfo: { year: input.dateInfo.year, month: input.dateInfo.month, day: input.dateInfo.day },
      city: { province: input.city.province, city: input.city.city, longitude: input.city.longitude },
      segment: input.segment,
      dstApplied: input.dstApplied,
      gender: input.gender,
      name: input.name,
      evaluatedAt: evaluatedAt.toISOString(),
      evaluatedDate: {
        year: evaluatedAt.getFullYear(), month: evaluatedAt.getMonth() + 1, day: evaluatedAt.getDate(),
      },
    },
  };
}
