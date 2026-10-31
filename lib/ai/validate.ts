import type { AgeFacts } from '@/lib/ziwei/facts';
import { isHealthQuestion, isMarriageQuestion } from './chart-to-text';
import { firstSentence, firstSentenceJargon, UNKNOWN_TIME_OPENING } from './jargon';

export const NORMAL_CLOSING = '命理只是参考，具体选择还看你自己的实际情况。';
export const HEALTH_CLOSING = '命理只作参考，身体不适请及时就医。';
export const closingPattern = () => /命理(?:只是|只作|仅作|仅供|仅是|仅为|只供)参考[^。！？\n]*[。！？]?/g;
export type IssueType = 'first-sentence-jargon' | 'age-not-in-facts' | 'marriage-no-candidate' | 'closing-line' | 'placeholder-left';
export interface AnswerIssue { type: IssueType; start: number; end: number; paragraphIndex: number; explanation: string }
export interface ValidationInput { text: string; mode: string; facts: AgeFacts; question: string }
export const closingFor = (text: string, question: string) => isHealthQuestion(question + text) ? HEALTH_CLOSING : NORMAL_CLOSING;
const inside = (a: number, b: number, ranges: [number, number][]) => ranges.some(([lo, hi]) => a >= lo && b <= hi);

/** Arabic digits only; supports 虚岁 38–41 / 38–41岁 / 公历 2027–2030 / 2027、2029 年.
 * Never matches 一岁、万年、多年、去年、今年. Prefix/range is consumed atomically. */
export function numericReferences(text: string) {
  const re = /(?<!\d)(?:(虚岁|公历)[ \t]*)?(\d+)(?:[ \t]*[–—\-~～至到][ \t]*(\d+))?[ \t]*(虚岁|岁|年)?(?!\d)/g;
  return [...text.matchAll(re)].filter(m => m[1] || m[4] || (/^\d{4}$/.test(m[2]) && /^[、，\s\d]+年/.test(text.slice(m.index! + m[0].length))))
    .map(m => ({ start: m.index!, end: m.index! + m[0].length, lo: Number(m[2]), hi: Number(m[3] ?? m[2]), year: m[1] === '公历' || m[4] === '年' || Number(m[2]) >= 1800 }));
}
export function validateAnswer({ text, facts, question }: ValidationInput): AnswerIssue[] {
  const issues: AnswerIssue[] = [];
  const add = (type: IssueType, start: number, end: number, explanation: string) => issues.push({ type, start, end, paragraphIndex: text.slice(0, start).split(/\n\s*\n/).length - 1, explanation });
  const first = firstSentence(text.trimStart());
  if (!(facts.birthTimeKnown === false && first.startsWith(UNKNOWN_TIME_OPENING)) && firstSentenceJargon(first)) add('first-sentence-jargon', text.length - text.trimStart().length, text.length - text.trimStart().length + first.length, '首句含命理术语，需改成白话直接答案');
  const marriage = isMarriageQuestion(question), health = isHealthQuestion(question), explicitDecadal = /(?:第.{0,3}|哪个|某个|这个|所选|当前|现在|走的|我的)大限|大限.*(?:年龄|几岁|起止|范围)/.test(question);
  const cs = facts.marriage.candidates, years = facts.marriage.years;
  const candidateRange: [number, number][] = years.length ? [[Math.min(...years), Math.max(...years)]] : [];
  const candidateAges: [number, number][] = cs.length ? [[Math.min(...cs.map(c => c.nominalAge)), Math.max(...cs.map(c => c.nominalAge))]] : [];
  const refs = numericReferences(text);
  for (const r of refs) {
    const w = facts.whitelist, single = r.lo === r.hi;
    let valid = r.lo <= r.hi && (single ? (r.year ? w.years : w.ages).includes(r.lo) : false);
    if (marriage && !explicitDecadal) {
      valid = valid && (r.year ? [...years, ...(health ? facts.health.years : []), facts.currentYear, facts.selected?.year, facts.birthYear].includes(r.lo) : [...cs.map(c => c.nominalAge), ...(health ? facts.health.entries.map(e => e.nominalAge) : []), facts.currentAge, facts.selected?.nominalAge].includes(r.lo));
      if (!single) valid = inside(r.lo, r.hi, r.year ? candidateRange : candidateAges);
    } else if (health && !explicitDecadal) {
      valid = valid && (r.year ? [...facts.health.years, facts.currentYear, facts.selected?.year].includes(r.lo) : [...facts.health.entries.map(e => e.nominalAge), facts.currentAge, facts.selected?.nominalAge].includes(r.lo));
    } else valid ||= inside(r.lo, r.hi, r.year ? w.yearRanges : w.ageRanges);
    if (!valid) add('age-not-in-facts', r.start, r.end, '年龄或年份不在本题事实白名单/候选范围内');
  }
  const hasMarriage = /\{\{MARRIAGE_(?:RANGE|YEARS)\}\}/.test(text) || refs.some(r => r.year ? years.includes(r.lo) && years.includes(r.hi) : cs.some(c => c.nominalAge === r.lo) && cs.some(c => c.nominalAge === r.hi));
  if (marriage && !facts.marriage.unavailable && !hasMarriage) add('marriage-no-candidate', 0, first.length, '婚期问题未使用任何固定候选，请用婚期占位符补充');
  const closings = [...text.matchAll(closingPattern())];
  if (closings.length !== 1 || !text.trimEnd().endsWith(closings[0]?.[0] ?? '\0') || closings[0]?.[0] !== closingFor(text, question)) add('closing-line', text.length, text.length, '全文需在末尾恰好一句对应轻提示');
  for (const m of text.matchAll(/\{\{[^{}]*(?:\}\}|$)/g)) add('placeholder-left', m.index!, m.index! + m[0].length, '残留占位符');
  return issues;
}
export function logIssues(issues: AnswerIssue[]) {
  const counts: Partial<Record<IssueType, number>> = {};
  for (const issue of issues) counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  if (issues.length) console.warn('[ai-consistency]', counts);
}
