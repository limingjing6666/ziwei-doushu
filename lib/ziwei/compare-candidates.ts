import type { Candidate } from './fuzzy-time';
import type { SiHua, ZiweiChart } from './types';
import { getDaXianIndexForAge } from './yunxian-context';

const MARKS = ['禄', '权', '科', '忌'] as const;
export type ComparablePalace = Readonly<{ name: string; branch: number }>;
export type NatalIdentity = Readonly<{ star: string; mark: SiHua }>;
export type ComparableDaXian = Readonly<{ palace: ComparablePalace; startAge: number }> | null;
export type ComparableFields = Readonly<{
  natal: readonly (NatalIdentity & Readonly<{ palace: ComparablePalace }>)[];
  ming: ComparablePalace;
  shen: ComparablePalace;
  currentDaXian: ComparableDaXian;
}>;
export type ComparisonStatus = 'all-same' | 'partly-different' | 'all-different';
export type ComparedField<T> = Readonly<{
  status: ComparisonStatus;
  groups: readonly Readonly<{ value: T; candidateIds: readonly string[] }>[];
}>;
export type CandidateComparison = Readonly<{
  natal: readonly Readonly<{
    mark: SiHua;
    identity: ComparedField<NatalIdentity>;
    palace: ComparedField<ComparablePalace>;
    consistentPalace: ComparablePalace | null; // 身份、落宫都全一致才可附在一致项中
  }>[];
  ming: ComparedField<ComparablePalace>;
  shen: ComparedField<ComparablePalace>;
  currentDaXian: ComparedField<ComparableDaXian>;
}>;

function one<T>(values: readonly T[]): T {
  if (values.length !== 1) throw new Error('比较字段缺失或重复');
  return values[0];
}

export function extractComparableFields(chart: ZiweiChart): ComparableFields {
  const palaces = chart.palaces;
  if (!Array.isArray(palaces) || palaces.length !== 12
    || new Set(palaces.map(p => p.branch)).size !== 12
    || new Set(palaces.map(p => p.name)).size !== 12) {
    throw new Error('十二宫缺失或重复');
  }
  for (const p of palaces) {
    if (!Number.isInteger(p.branch) || p.branch < 0 || p.branch > 11
      || typeof p.name !== 'string' || !p.name.trim() || !Array.isArray(p.stars)) {
      throw new Error('宫位比较字段非法');
    }
  }
  const palace = (branch: number): ComparablePalace => {
    const p = one(palaces.filter(item => item.branch === branch));
    return { name: p.name, branch: p.branch };
  };
  const ming = palace(chart.mingGongBranch);
  const shen = palace(chart.shenGongBranch);
  if (ming.name !== '命宫'
    || one(palaces.filter(p => p.isMingGong)).branch !== ming.branch
    || one(palaces.filter(p => p.isShenGong)).branch !== shen.branch) {
    throw new Error('命宫或身宫标记不一致');
  }
  const natal = MARKS.map(mark => one(palaces.flatMap(p =>
    p.stars.filter(s => s.siHua === mark).map(s => {
      if (typeof s.name !== 'string' || !s.name.trim()) throw new Error('四化星名缺失');
      return { star: s.name, mark, palace: palace(p.branch) };
    }),
  )));
  if (!Number.isInteger(chart.currentAge) || !Array.isArray(chart.daXians) || !chart.daXians.length) {
    throw new Error('当前年龄或大限字段缺失');
  }
  chart.daXians.forEach((dx, i) => {
    if (!Number.isInteger(dx.startAge) || !Number.isInteger(dx.endAge) || dx.startAge > dx.endAge
      || (i > 0 && chart.daXians[i - 1].endAge >= dx.startAge)
      || dx.palaceName !== palace(dx.palaceBranch).name) {
      throw new Error('大限字段缺失、重复或不一致');
    }
  });
  const index = chart.currentDaXianIndex;
  if (!Number.isInteger(index) || index < -1 || index >= chart.daXians.length
    || index !== getDaXianIndexForAge(chart, chart.currentAge)) {
    throw new Error('当前大限索引与年龄不一致');
  }
  const dx = index === -1 ? null : chart.daXians[index];
  return {
    natal, ming, shen,
    currentDaXian: dx ? { palace: palace(dx.palaceBranch), startAge: dx.startAge } : null,
  };
}

export function compareCandidates(candidates: readonly Candidate[]): CandidateComparison {
  if (!Array.isArray(candidates) || !candidates.length) throw new Error('候选不能为空');
  if (candidates.some(c => typeof c.id !== 'string' || !c.id.trim())
    || new Set(candidates.map(c => c.id)).size !== candidates.length) {
    throw new Error('候选标识缺失或重复');
  }
  const fields = candidates.map(c => extractComparableFields(c.chart));
  const compare = <T>(pick: (fields: ComparableFields) => T): ComparedField<T> => {
    const groups = new Map<string, { value: T; candidateIds: string[] }>();
    fields.forEach((item, index) => {
      const value = pick(item);
      // 值均由提取器按固定字段次序构造，不比较对象引用或展示文案。
      const key = JSON.stringify(value);
      const previous = groups.get(key);
      if (previous) previous.candidateIds.push(candidates[index].id);
      else groups.set(key, { value, candidateIds: [candidates[index].id] });
    });
    return {
      status: groups.size === 1 ? 'all-same'
        : groups.size === candidates.length ? 'all-different' : 'partly-different',
      groups: [...groups.values()],
    };
  };
  return {
    natal: MARKS.map((mark, index) => {
      const identity = compare(item => ({ star: item.natal[index].star, mark }));
      const palace = compare(item => item.natal[index].palace);
      return {
        mark, identity, palace,
        consistentPalace: identity.status === 'all-same' && palace.status === 'all-same'
          ? palace.groups[0].value : null,
      };
    }),
    ming: compare(item => item.ming),
    shen: compare(item => item.shen),
    currentDaXian: compare(item => item.currentDaXian),
  };
}
