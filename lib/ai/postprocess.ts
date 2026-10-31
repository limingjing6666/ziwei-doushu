import { subjectAt, type AnswerFacts } from './facts';

export function placeholderValues(facts: AnswerFacts): Record<string, string> {
  const health = (f: AnswerFacts) => f.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）`).join('、');
  const subjects = facts.subjects;
  return {
    ...(!facts.marriage.unavailable ? { MARRIAGE_RANGE: facts.marriage.rangeText, MARRIAGE_YEARS: `${facts.marriage.years.join('、')} 年` } : {}),
    ...(subjects ? {
      HEALTH_YEARS: `甲方：${health(subjects.A) || '目前无法确定'}；乙方：${health(subjects.B) || '目前无法确定'}`,
      HEALTH_YEARS_A: `甲方：${health(subjects.A) || '目前无法确定'}`,
      HEALTH_YEARS_B: `乙方：${health(subjects.B) || '目前无法确定'}`,
    } : facts.health.years.length ? { HEALTH_YEARS: health(facts) } : {}),
  };
}
/** Unknown/unavailable tokens are removed; callback receives no user data. */
export function fillPlaceholders(text: string, facts: AnswerFacts, onUnknown: () => void = () => {}): string {
  const values = placeholderValues(facts);
  return text.replace(/\{\{([^{}]*)\}\}/g, (_all, key: string, offset: number) => {
    key = key.trim();
    const subject = facts.subjects && subjectAt(text, offset);
    if (key === 'HEALTH_YEARS' && subject) return values[`HEALTH_YEARS_${subject}`].slice(3);
    if (Object.hasOwn(values, key)) return values[key];
    onUnknown(); return '';
  });
}
/** Holds a trailing single { too: the opening braces can themselves straddle chunks.
 * A malformed token longer than 40 chars is released; final dangling tokens are deleted. */
export function createPlaceholderBuffer(facts: AnswerFacts, onUnknown: () => void = () => {}) {
  let pending = '', identity = '';
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
      if (end >= 0) {
        const subject = subjectAt(identity + out, (identity + out).length);
        const prefix = subject ? `${subject}方：` : '';
        out += fillPlaceholders(prefix + pending.slice(0, end + 2), facts, onUnknown).slice(prefix.length);
        pending = pending.slice(end + 2);
      }
      else if (final) { onUnknown(); pending = ''; }
      else if (pending.length > 40) { out += pending; pending = ''; }
      else break;
    }
    const subject = subjectAt(identity + out, (identity + out).length);
    // Keep a short tail as well: the identity label itself may straddle chunks (乙 / 方).
    identity = (subject ? `${subject}方：` : '') + (identity + out).slice(-8);
    return out;
  };
  return { push: (chunk: string) => push(chunk), finish: () => push('', true) };
}
