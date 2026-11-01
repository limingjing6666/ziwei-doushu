import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { safeReference } from './knowledge';

type Topic = 'overview' | 'love';
type Excerpt = [string, string, string];
type PilotRecord = Record<Topic, Excerpt>;
type PilotData = { ms: string[]; texts: Record<Topic, Excerpt[]>; years: Record<string, string> };
type PilotBirth = Pick<BirthInfo, 'year' | 'month' | 'day' | 'hour' | 'gender' | 'birthTimeKnown'> & { leapMonthPolicy?: string };

// Replaceable in regression tests; production only imports the bundled file, never fetches.
export const pilotDatasetLoader = {
  // JSON inference loses tuple lengths; lookup validates all three fields before returning them.
  load: async (): Promise<PilotData> => (await import('./dataset/pilot-v4.json')).default as unknown as PilotData,
};
const unzip = promisify(gunzip);
const years = new Map<number, Promise<Buffer>>();

export async function lookupPilotRecord(birth: PilotBirth, mingFirstMajor: string | null): Promise<PilotRecord | null> {
  try {
    const { year, month, day, hour, gender, birthTimeKnown, leapMonthPolicy } = birth;
    if (birthTimeKnown === false || !Number.isInteger(year) || year < 1950 || year > 2026
      || !Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(hour) || hour < 0 || hour > 11
      || (gender !== 'male' && gender !== 'female') || (leapMonthPolicy !== undefined && leapMonthPolicy !== 'split')) return null;
    const date = Date.UTC(year, month - 1, day), probe = new Date(date);
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    const data = await pilotDatasetLoader.load();
    const packed = data.years[String(year)];
    if (!packed) return null;
    let pending = years.get(year);
    if (!pending) {
      pending = unzip(Buffer.from(packed, 'base64'));
      years.set(year, pending);
      void pending.catch(() => years.delete(year));
    }
    const bytes = await pending;
    const nDays = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    const size = nDays * 24;
    if (bytes.length !== size * 3) return null;
    const dayOfYear = (date - Date.UTC(year, 0, 1)) / 86400000 + 1;
    const pos = ((dayOfYear - 1) * 12 + hour) * 2 + (gender === 'female' ? 1 : 0);
    const ms = bytes[size * 2 + pos];
    const recordedMajor = ms === 254 ? null : data.ms[ms];
    if (recordedMajor === undefined || recordedMajor !== mingFirstMajor) return null;
    const overview = data.texts.overview[bytes[pos]], love = data.texts.love[bytes[size + pos]];
    if (![overview, love].every(t => t?.length === 3 && t.every(s => typeof s === 'string'))) return null;
    return { overview, love };
  } catch { return null; }
}

const restrictedParagraph = /\u500a|\u502a|\u5929\u7eaa|\u5929\u7d00|克夫|克妻|刑克|死别|埋尸|坟|冢|夭折|自杀/;
const disclaimer = /仅供参考|仅作参考|供参考|不构成|免责|不能替代|请?咨询(专业|医生|医师|律师)|就医|AI|人工智能|古籍[^。]*表述/i;
const parentheticalDisclaimer = /（[^（）]*(?:仅供参考|仅作参考|供参考|不构成|免责|不能替代|请?咨询(?:专业|医生|医师|律师)|就医|AI|人工智能|古籍[^。]*表述)[^（）]*）|\([^()]*(?:仅供参考|仅作参考|供参考|不构成|免责|不能替代|请?咨询(?:专业|医生|医师|律师)|就医|AI|人工智能|古籍[^。]*表述)[^()]*\)/gi;
const timelineOrSihua = /\d+\s*岁|[一二三四五六七八九十百]+岁|\d{4}\s*年|大限|流年|今年|明年|运限|化禄|化权|化科|化忌|四化/;

/** Input-only filtering: keep paragraph boundaries and discard unsafe claims, not just their keywords. */
export function cleanReferenceText(raw: string): string {
  return raw.split(/\n\s*\n/).filter(p => !restrictedParagraph.test(p)).map(p => safeReference(p))
    .map(p => p.replace(parentheticalDisclaimer, '').split(/(?<=[。！？；])/)
      .filter(s => !disclaimer.test(s) && !timelineOrSihua.test(s)).join('').trim())
    .filter(Boolean).join('\n\n');
}

export function buildDatasetReference(topic: Topic, rec: PilotRecord, cap = 1500): string {
  if (!Number.isFinite(cap) || cap <= 0) return '';
  const text = rec[topic].map(cleanReferenceText).filter(Boolean).join('\n\n');
  if (text.length <= Math.floor(cap)) return text;
  // Ordered prefix keeps the overview before either of the supplementary excerpts.
  const prefix = text.slice(0, Math.floor(cap));
  const end = Math.max(...['。', '！', '？', '；'].map(p => prefix.lastIndexOf(p)));
  return end < 0 ? '' : prefix.slice(0, end + 1).trim();
}

export function detectDatasetTopic(scenario: string, hasSecondChart: boolean, messages: { role: string; content: string }[]): Topic | null {
  if (scenario !== 'overview' || hasSecondChart || messages.length !== 1 || messages[0].role !== 'user') return null;
  if (messages[0].content.startsWith('【整盘】')) return 'overview';
  if (messages[0].content.startsWith('【感情】')) return 'love';
  return null;
}

export async function getDatasetReference(chart: ZiweiChart, topic: Topic): Promise<{ text: string; hit: boolean; ms: number }> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([
      (async () => {
        const major = chart.palaces.find(p => p.branch === chart.mingGongBranch)?.stars.find(s => s.type === 'major')?.name ?? null;
        const rec = await lookupPilotRecord(chart.birthInfo, major);
        return rec ? buildDatasetReference(topic, rec) : '';
      })(),
      new Promise<string>(resolve => { timer = setTimeout(() => resolve(''), 800); }),
    ]);
    return { text, hit: !!text, ms: Math.max(0, Date.now() - start) };
  } catch { return { text: '', hit: false, ms: Math.max(0, Date.now() - start) }; }
  finally { clearTimeout(timer); }
}
