import type { AgeFacts } from '@/lib/ziwei/facts';
import { ageFactsToText } from './chart-to-text';
import { isHealthQuestion } from './intent';

/** Compatibility keeps A's common marriage source, but never merges personal age/health facts. */
export type AnswerFacts = AgeFacts & { subjects?: { A: AgeFacts; B: AgeFacts } };
export function compatibilityFacts(A: AgeFacts, B: AgeFacts): AnswerFacts {
  return { ...A, birthTimeKnown: A.birthTimeKnown && B.birthTimeKnown, subjects: { A, B } };
}
export function subjectAt(text: string, offset: number): 'A' | 'B' | undefined {
  // Explicit identity remains in scope until the next identity (including paragraph headers).
  const label = [...text.slice(0, offset).matchAll(/甲方|乙方|\b[AB](?:方)?\b/gi)].at(-1)?.[0];
  return label ? /乙|b/i.test(label) ? 'B' : 'A' : undefined;
}
export function referenceFacts(facts: AnswerFacts, text: string, offset: number): AgeFacts[] {
  if (!facts.subjects) return [facts];
  const subject = subjectAt(text, offset);
  return subject ? [facts.subjects[subject]] : [facts.subjects.A, facts.subjects.B];
}
export function repairFactsToText(facts: AnswerFacts, question: string): string {
  if (!facts.subjects) return ageFactsToText(facts, question);
  return `【甲方 A；共同婚期候选唯一来源】\n${ageFactsToText(facts.subjects.A, question)}\n【乙方 B；不得套用甲方年龄、出生年或健康年份】\n${ageFactsToText(facts.subjects.B, isHealthQuestion(question) ? '健康' : '')}\n健康占位符按所属人使用 {{HEALTH_YEARS_A}} / {{HEALTH_YEARS_B}}。`;
}
