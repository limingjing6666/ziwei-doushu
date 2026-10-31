import { detectPatterns } from '@/lib/ziwei/patterns';
import { STAR_DB, type StarProfile } from '@/lib/ziwei/db-analysis';
import { STAR_IN_FUQI_GU } from '@/lib/ziwei/heming-knowledge';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { palaceKey } from './chart-to-text';

// Defense in depth for existing knowledge modules too. Never feed ni_quote or raw methodology.
export function safeReference(value: string): string {
  // Drop the whole paragraph when restricted: a quotation may contain sentence punctuation.
  return value.split(/\n\s*\n/).filter(s => !/天纪|倪师|倪海厦|倪先生|B\s*站|bilibili|BV\w+|\d{1,2}[:：]\d{2}|第\s*\d+\s*[集讲]|[pP]\d{2}|同集|死别|埋尸|坟|冢|夭|必离|离婚|刑克|克夫|克妻|重大灾|残疾|前世欠债/i.test(s)).join('\n').replace(/�/g, '');
}
const PALACES: [string, keyof StarProfile][] = [
  ['命宫', 'mingGong'], ['夫妻', 'fuQi'], ['福德', 'fuDe'], ['财帛', 'caiBo'],
  ['官禄', 'guanLu'], ['迁移', 'qianYi'], ['疾厄', 'jiE'], ['田宅', 'tianZhai'],
];

function chartReferences(chart: ZiweiChart, label: string, patternLimit = 6): string[] {
  const parts: string[] = [];
  for (const pattern of detectPatterns(chart).slice(0, patternLimit)) {
    parts.push(`${label}命中格局【${pattern.name}】（${pattern.palaces.join('、')}）：${safeReference(pattern.description)}\n条件：${safeReference(JSON.stringify(pattern.conditions ?? {}))}`);
  }
  for (const [palace, field] of PALACES) {
    const p = chart.palaces.find(p => palaceKey(p.name) === palace);
    if (!p) continue;
    const stars = p.stars.filter(s => s.type === 'major').map(s => s.name);
    const key = stars.length ? stars : p.branch >= 0 ? chart.palaces.find(q => q.branch === (p.branch + 6) % 12)?.stars.filter(s => s.type === 'major').map(s => s.name) ?? [] : [];
    const exactKey = Object.keys(STAR_DB).find(k => {
      if (k.startsWith('空宫借:') !== (stars.length === 0)) return false;
      const names = k.replace(/^空宫借:/, '').split('+');
      return names.length === key.length && key.every(s => names.includes(s));
    });
    const exact = exactKey ? STAR_DB[exactKey]?.[field] : undefined;
    const references = exact ? [exact] : stars.map(s => Object.hasOwn(STAR_DB, s) ? STAR_DB[s]?.[field] : undefined).filter((s): s is string => !!s);
    for (const reference of references) parts.push(`${label}${p.name}（${stars.join('、') || '空宫，借对宫参照'}）：\n${safeReference(reference).slice(0, 650)}`);
  }
  return parts;
}

/** Hard cap applies across both charts AND marriage references, not separately. */
export function retrieveKnowledge(a: ZiweiChart, b?: ZiweiChart): string {
  const parts = chartReferences(a, b ? 'A' : '本盘', b ? 3 : 6);
  if (b) {
    const other = chartReferences(b, 'B', 3);
    // Interleave so the first chart cannot starve the second of reference space.
    const first = parts.splice(0);
    for (let i = 0; i < Math.max(first.length, other.length); i++) {
      if (first[i]) parts.push(first[i]);
      if (other[i]) parts.push(other[i]);
    }
    const spouses: string[] = [];
    for (const [label, c] of [['A', a], ['B', b]] as const) {
      const palace = c.palaces.find(p => palaceKey(p.name) === '夫妻');
      for (const star of palace?.stars.filter(s => s.type === 'major') ?? []) {
        const entry = Object.hasOwn(STAR_IN_FUQI_GU, star.name) ? STAR_IN_FUQI_GU[star.name] : undefined;
        if (entry) spouses.push(`${label}夫妻宫${star.name}（合盘知识条目，仅作互动偏好参考）：${safeReference(entry.spouse_traits)}；条件性助力：${safeReference(entry.good)}`);
      }
    }
    parts.unshift(...spouses);
  }
  return parts.join('\n\n').slice(0, 6000);
}
