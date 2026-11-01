// 紫微斗数开源解读数据集 v4.0 / 王多鱼AI / CC BY 4.0
// https://github.com/Renhuai123/ziwei-doushu ; modified: extracted, filtered, rewritten, deduplicated.
// Local wording references only; chart facts and the site's default brightness table are unchanged.
import generated from '@/lib/ziwei/star-rules.generated.json';
import type { Palace, SiHua, Star, ZiweiChart } from '@/lib/ziwei/types';
import { palaceKey } from './chart-to-text';

type BrightnessCondition = [star: string, raw: string, allowed: string[]];
export type StoredRule = [textId: number, brightness: BrightnessCondition[], marks: [string, SiHua][]];
const data = generated as unknown as { texts: string[]; rules: StoredRule[]; index: Record<string, number[]> };
export type RuleReference = {
  id: number; key: string; kind: string; palace: string; star: string; other: string; mark: string;
  text: string; reference: string;
};
export type RuleOptions = { question?: string; topic?: string; label?: string; maxChars?: number; maxItems?: number };

export const normalizeReferenceText = (s: string) => s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');

const INTENTS: [string, RegExp][] = [
  ['夫妻', /love|夫妻|感情|婚|恋爱|伴侣|配偶/i], ['官禄', /career|官禄|事业|工作|职业/i],
  ['财帛', /wealth|财|收入|赚钱/i], ['迁移', /move|迁移|出行|外出|异地/i],
  ['福德', /spirit|福德|心态|心情/i], ['田宅', /home|田宅|房|家宅/i],
  ['父母', /parents|父母|长辈/i], ['子女', /children|子女|孩子/i], ['兄弟', /family|兄弟|姐妹/i],
  ['仆役', /friends|交友|仆役|人际|朋友/i],
];

export function rulePalaces(opts: RuleOptions): { palaces: string[]; focused: boolean } {
  const intent = `${opts.topic ?? ''} ${opts.question ?? ''}`;
  const palaces = INTENTS.filter(([, re]) => re.test(intent)).map(([p]) => p);
  return palaces.length ? { palaces: [...palaces, ...(palaces.includes('命宫') ? [] : ['命宫'])], focused: true }
    : { palaces: ['命宫', '夫妻', '官禄', '财帛'], focused: false };
}

// Raw fine-grade brightness wins. Coarse values are usable only when they imply
// EXACTLY the same allowed raw grades; 'dim' never silently means '陷'.
function brightnessMatches(star: Star, allowed: string[]): boolean {
  if (star.brightnessRaw) return allowed.includes(star.brightnessRaw);
  const coarse = { bright: ['庙', '旺'], normal: ['得', '利', '平', '地'], dim: ['不', '闲', '陷'] };
  return !!star.brightness && coarse[star.brightness].every(b => allowed.includes(b));
}

/** Complete predicate, also exported for synthetic conflict/missing-condition regressions. */
export function matchesStarRule(palace: Palace, key: string, rule: StoredRule, opposite?: Palace): boolean {
  const [kind, p, star, other, mark] = key.split('|');
  if (palaceKey(palace.name) !== p) return false;
  const resident = palace.stars.some(s => s.type === 'major');
  if (kind === 'bpair' && (resident || palace.oppositeBranch === undefined || opposite?.branch !== palace.oppositeBranch)) return false;
  if ((kind === 'pair' || kind === 'sihua') && !resident) return false;
  const subjectPalace = kind === 'bpair' ? opposite! : palace;
  const actual = subjectPalace.stars.find(s => s.name === star);
  if (!actual) return false;
  if (kind === 'aux' && (actual.type === 'major' || !['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马'].includes(star))) return false;
  if (kind === 'pair' && (actual.type !== 'major' || !palace.stars.some(s => s.name === other && s.type !== 'major'))) return false;
  if (kind === 'bpair' && (actual.type !== 'major' || !palace.stars.some(s => s.name === other && s.type !== 'major' && ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马', '擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(other)))) return false;
  if (kind === 'sihua' && (!mark || actual.siHua !== mark)) return false; // natal only; never daXians/selfSihua/yearly marks
  if (!['aux', 'sihua', 'pair', 'bpair'].includes(kind)) return false;
  return rule[1].every(([name, , allowed]) => {
    const s = (kind === 'bpair' && name === star ? subjectPalace : palace).stars.find(s => s.name === name);
    return !!s && brightnessMatches(s, allowed);
  }) && rule[2].every(([name, mark]) => palace.stars.some(s => s.name === name && s.siHua === mark));
}

function candidates(p: Palace, label: string, opposite?: Palace): RuleReference[] {
  const resident = p.stars.some(s => s.type === 'major');
  const palace = palaceKey(p.name), keys: string[] = [];
  for (const s of p.stars) {
    if (resident && s.siHua) keys.push(`sihua|${palace}|${s.name}||${s.siHua}`);
    keys.push(`aux|${palace}|${s.name}||`);
    if (s.type === 'major') for (const other of p.stars.filter(s => s.type !== 'major')) keys.push(`pair|${palace}|${s.name}|${other.name}|`);
  }
  if (!resident) for (const s of opposite?.stars.filter(s => s.type === 'major') ?? []) {
    for (const other of p.stars.filter(s => s.type !== 'major')) keys.push(`bpair|${palace}|${s.name}|${other.name}|`);
  }
  const result: RuleReference[] = [];
  for (const key of keys) for (const id of data.index[key] ?? []) {
    const rule = data.rules[id];
    if (!rule || !matchesStarRule(p, key, rule, opposite)) continue;
    const [kind, , star, other, mark] = key.split('|'), text = data.texts[rule[0]];
    const name = palace === '命宫' ? palace : `${palace}宫`;
    const source = `${star}${other ? `+${other}` : ''}${mark ? `生年化${mark}` : ''}`;
    const prefix = kind === 'bpair' ? `${label}${name}（空宫，借对宫${star}参照；本宫实坐${other}）`
      : kind === 'aux' ? `${label}${name}（本宫实坐${star}）` : `${label}${name}·${source}`;
    result.push({ id, key, kind, palace, star, other, mark, text, reference: `${prefix}：${text}` });
  }
  return result;
}

/** Only explicit bpair borrowing; no nearest-key fallback, networking, or chart mutation. */
export function ruleReferences(chart: ZiweiChart, opts: RuleOptions = {}): RuleReference[] {
  if (chart.birthInfo.birthTimeKnown === false) return [];
  const maxChars = Math.max(0, Math.min(800, opts.maxChars ?? 800));
  const maxItems = Math.max(0, Math.min(6, opts.maxItems ?? 6));
  const { palaces, focused } = rulePalaces(opts);
  const buckets = palaces.map(name => {
    const palace = chart.palaces.find(p => palaceKey(p.name) === name);
    // The chart engine supplies oppositeBranch (= branch + 6); never infer it from array order.
    const opposite = palace?.oppositeBranch === undefined ? undefined : chart.palaces.find(p => p.branch === palace.oppositeBranch);
    return palace ? candidates(palace, opts.label ?? '本盘', opposite) : [];
  });
  const selected: RuleReference[] = [], seen = new Set<string>();
  let chars = 0;
  const take = (bucket: RuleReference[], limit: number) => {
    let count = 0;
    for (const candidate of bucket) {
      const normalized = normalizeReferenceText(candidate.text);
      if (selected.length >= maxItems || count >= limit) break;
      if (seen.has(normalized) || chars + candidate.reference.length + (selected.length ? 2 : 0) > maxChars) continue;
      seen.add(normalized); selected.push(candidate); count++;
      chars += candidate.reference.length + (selected.length > 1 ? 2 : 0);
    }
  };
  if (focused) {
    // Requested palace first, with one slot reserved for a natal anchor.
    const targetSlots = maxItems > 1 ? maxItems - 1 : 1;
    for (const bucket of buckets.slice(0, -1)) take(bucket, Math.max(0, targetSlots - selected.length));
    take(buckets[buckets.length - 1], 1);
  } else {
    for (const bucket of buckets) take(bucket, 1);
    for (const bucket of buckets) take(bucket, 1); // at most two per overview palace
  }
  return selected;
}
