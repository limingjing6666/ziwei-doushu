import rules from './rules.json';
import type { Palace, ZiweiChart } from '../types';

export type MethodRule = (typeof rules)[number];
const palaceName = (s: string) => s === '命' ? '命宫' : s === '命宫' ? s : s.replace(/宫$/, '');

export const RULE_INDEX = {
  star: new Map<string, MethodRule[]>(), palace: new Map<string, MethodRule[]>(),
  pattern: new Map<string, MethodRule[]>(), sihua: new Map<string, MethodRule[]>(),
};
for (const rule of rules) {
  for (const [index, keys] of [
    [RULE_INDEX.star, rule.condition.stars], [RULE_INDEX.palace, rule.condition.palaces],
    [RULE_INDEX.pattern, rule.condition.patterns], [RULE_INDEX.sihua, rule.condition.sihua],
  ] as const) for (const key of keys ?? []) index.set(key, [...(index.get(key) ?? []), rule]);
}

function related(base: Palace, chart: ZiweiChart, relation?: string): Palace[] {
  if (!relation || relation === 'same') return [base];
  if (base.branch < 0 || base.branch > 11) return [];
  const offsets = relation === 'adjacent' ? [1, 11] : [0, 4, 6, 8];
  return chart.palaces.filter(p => offsets.some(o => p.branch === (base.branch + o) % 12));
}

export function matchesRule(rule: MethodRule, chart: ZiweiChart): boolean {
  const c = rule.condition;
  if (!Object.keys(c).length) return true;
  return chart.palaces.some(base => {
    if (c.palaces?.length && !c.palaces.some(p => palaceName(p) === palaceName(base.name))) return false;
    const scope = related(base, chart, c.relation);
    const stars = scope.flatMap(p => p.stars);
    if (c.stars?.some(name => !stars.some(s => s.name === name))) return false;
    if (c.sihua?.some(mark => !stars.some(s => s.siHua === mark))) return false;
    if (c.absent_sihua?.some(mark => stars.some(s => s.siHua === mark))) return false;
    if (c.bright && c.stars?.some(name => !stars.some(s => s.name === name && ['庙', '旺'].includes(s.brightnessRaw ?? '')))) return false;
    if (c.support_any?.length || c.sihua_any?.length) {
      const support = stars.some(s => c.support_any?.includes(s.name) || c.sihua_any?.includes(s.siHua ?? ''));
      if (!support) return false;
    }
    // For flanking rules, the two required stars must occupy different neighbors.
    if (c.relation === 'adjacent' && c.stars?.length === 2) {
      if (!scope.every(p => c.stars!.some(name => p.stars.some(s => s.name === name)))) return false;
    }
    return true;
  });
}

export function retrieveMethod(chart: ZiweiChart, label: string, maxChars = 1400): string {
  const selected = rules.filter(r => Object.keys(r.condition).length && matchesRule(r, chart)).slice(0, 6);
  selected.unshift(...rules.filter(r => ['structure', 'decade'].includes(r.id)));
  const lines = selected.map(r => `${label}方法[${r.id} / ${r.confidence === 'high' ? '跨主题或讲次复现' : '单处经验，须核对'}]：${r.claim} 条件：${JSON.stringify(r.condition)}`);
  return lines.join('\n').slice(0, maxChars);
}
