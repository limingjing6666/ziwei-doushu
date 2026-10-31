import type { AgeFacts } from '@/lib/ziwei/facts';

export function placeholderValues(facts: AgeFacts): Record<string, string> {
  return {
    ...(!facts.marriage.unavailable ? { MARRIAGE_RANGE: facts.marriage.rangeText, MARRIAGE_YEARS: `${facts.marriage.years.join('、')} 年` } : {}),
    ...(facts.health.years.length ? { HEALTH_YEARS: facts.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）`).join('、') } : {}),
  };
}
/** Unknown/unavailable tokens are removed; callback receives no user data. */
export function fillPlaceholders(text: string, facts: AgeFacts, onUnknown: () => void = () => {}): string {
  const values = placeholderValues(facts);
  return text.replace(/\{\{([^{}]*)\}\}/g, (_all, key: string) => {
    if (Object.hasOwn(values, key.trim())) return values[key.trim()];
    onUnknown(); return '';
  });
}
/** Holds a trailing single { too: the opening braces can themselves straddle chunks.
 * A malformed token longer than 40 chars is released; final dangling tokens are deleted. */
export function createPlaceholderBuffer(facts: AgeFacts, onUnknown: () => void = () => {}) {
  let pending = '';
  const push = (chunk: string, final = false) => {
    pending += chunk; let out = '';
    while (pending) {
      const start = pending.indexOf('{{');
      if (start < 0) {
        const keep = !final && pending.endsWith('{') ? 1 : 0;
        out += pending.slice(0, pending.length - keep); pending = keep ? '{' : ''; break;
      }
      out += pending.slice(0, start); pending = pending.slice(start);
      const end = pending.indexOf('}}', 2);
      if (end >= 0) { out += fillPlaceholders(pending.slice(0, end + 2), facts, onUnknown); pending = pending.slice(end + 2); }
      else if (final) { onUnknown(); pending = ''; }
      else if (pending.length > 40) { out += pending; pending = ''; }
      else break;
    }
    return out;
  };
  return { push: (chunk: string) => push(chunk), finish: () => push('', true) };
}
