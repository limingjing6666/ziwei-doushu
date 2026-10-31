import { subjectAt, type AnswerFacts } from './facts';
import { createSentenceWindow, deleteSentences, type TextSpan } from './disclaimer';

export function placeholderValues(facts: AnswerFacts): Record<string, string> {
  const health = (f: AnswerFacts) => f.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）`).join('、');
  const subjects = facts.subjects;
  const a = subjects && health(subjects.A), b = subjects && health(subjects.B);
  const combined = [a && `甲方：${a}`, b && `乙方：${b}`].filter(Boolean).join('；');
  return {
    ...(!facts.marriage.unavailable ? { MARRIAGE_RANGE: facts.marriage.rangeText, MARRIAGE_YEARS: `${facts.marriage.years.join('、')} 年` } : {}),
    ...(subjects ? {
      ...(combined ? { HEALTH_YEARS: combined } : {}),
      ...(a ? { HEALTH_YEARS_A: `甲方：${a}` } : {}),
      ...(b ? { HEALTH_YEARS_B: `乙方：${b}` } : {}),
    } : facts.health.years.length ? { HEALTH_YEARS: health(facts) } : {}),
  };
}
/** Missing or malformed tokens delete their entire sentence, never emit a meta fallback. */
export function fillPlaceholders(text: string, facts: AnswerFacts, onUnknown: () => void = () => {}): string {
  const values = placeholderValues(facts);
  const valueFor = (key: string, source: string, offset: number) => {
    const subject = facts.subjects && subjectAt(source, offset);
    if (key === 'HEALTH_YEARS' && subject) return values[`HEALTH_YEARS_${subject}`]?.slice(3);
    return values[key];
  };
  const missing: TextSpan[] = [];
  for (const m of text.matchAll(/\{\{([^{}]*?)(?:\}\}|$)/g)) {
    if (!m[0].endsWith('}}') || !valueFor(m[1].trim(), text, m.index!)) {
      onUnknown(); missing.push({ start: m.index!, end: m.index! + m[0].length });
    }
  }
  const clean = missing.length ? deleteSentences(text, missing) : text;
  return clean.replace(/\{\{([^{}]*)\}\}/g, (_all, key: string, offset: number) => valueFor(key.trim(), clean, offset) ?? '');
}
/** Sentence boundaries also prevent unknown tokens from leaking an earlier sentence prefix. */
export function createPlaceholderBuffer(facts: AnswerFacts, onUnknown: () => void = () => {}) {
  let reported = 0;
  return createSentenceWindow(text => {
    let count = 0;
    const filled = fillPlaceholders(text, facts, () => { count++; });
    while (reported < count) { onUnknown(); reported++; }
    return filled;
  }, 0);
}
