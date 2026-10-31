import { referenceFacts, type AnswerFacts } from './facts';
import { isHealthQuestion, isMarriageQuestion, isMarriageTimingQuestion } from './intent';
import { firstSentence, firstSentenceJargon, UNKNOWN_TIME_OPENING } from './jargon';

export const NORMAL_CLOSING = '命理只是参考，具体选择还看你自己的实际情况。';
export const HEALTH_CLOSING = '命理只作参考，身体不适请及时就医。';
export const closingPattern = () => /命理(?:只是|只作|仅作|仅供|仅是|仅为|只供)参考[^。！？\n]*[。！？]?/g;
export type IssueType = 'first-sentence-jargon' | 'age-not-in-facts' | 'marriage-no-candidate' | 'closing-line' | 'placeholder-left';
export interface AnswerIssue { type: IssueType; start: number; end: number; paragraphIndex: number; explanation: string }
export interface ValidationInput { text: string; mode: string; facts: AnswerFacts; question: string }
export const closingFor = (text: string, question: string) => isHealthQuestion(question + text) ? HEALTH_CLOSING : NORMAL_CLOSING;
/** Separate statements, not question-wide permissions (especially for health years). */
function referenceClause(text: string, start: number, end: number) {
  const before = [...text.slice(0, start).matchAll(/[。！？\n；;，,]/g)].at(-1);
  const after = /[。！？\n；;，,]/.exec(text.slice(end));
  return text.slice(before ? before.index! + 1 : 0, after ? end + after.index : text.length);
}

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
  const health = isHealthQuestion(question);
  const cs = facts.marriage.candidates, years = facts.marriage.years;
  const refs = numericReferences(text);
  for (const r of refs) {
    const clause = referenceClause(text, r.start, r.end), single = r.lo === r.hi;
    const owners = referenceFacts(facts, text, r.start);
    const decadal = /大限|大运/.test(clause);
    const birth = /出生|生于|生年/.test(clause);
    const selected = /所选|选定/.test(clause);
    const current = /当前(?:公历年|年份|年|虚岁|年龄)|现在(?:的)?(?:虚岁|年龄)|今年(?:的)?(?:虚岁|年龄)|现年/.test(clause);
    // A basic identity fact is not a marriage/health prediction, even in a sensitive question.
    const healthPrediction = isHealthQuestion(clause) && /关注|留意|注意|风险|不适|应期|关键|疾病|发病|欠佳|不佳/.test(clause);
    const healthClaim = isHealthQuestion(clause) || (health && !isMarriageQuestion(clause));
    const marriageClaim = /婚期|结婚|成婚|领证|候选|窗口/.test(clause) || (isMarriageTimingQuestion(question) && /适合|机会|重点|关键/.test(clause));
    const basic = !decadal && !(r.year && healthPrediction) && !marriageClaim && (birth || selected || current);
    let valid = owners.some(f => {
      if (basic) {
        const value = birth ? (r.year ? f.birthYear : undefined) : selected ? (r.year ? f.selected?.year : f.selected?.nominalAge) : (r.year ? f.currentYear : f.currentAge);
        return single && r.lo === value;
      }
      // Only exact decade ranges/boundaries describe a decade. Its interior is NOT a health whitelist.
      if (decadal && !healthPrediction && !marriageClaim && (!single || /起于|止于|开始|结束|起止|起点|终点|起限|首年|末年/.test(clause))) {
        return f.decadals.some(d => {
          const lo = r.year ? d.startYear : d.startAge, hi = r.year ? d.endYear : d.endAge;
          return single ? r.lo === lo || r.lo === hi : r.lo === lo && r.hi === hi;
        });
      }
      if (healthClaim) return single && (r.year ? f.health.years : f.health.entries.map(e => e.nominalAge)).includes(r.lo);
      if (marriageClaim) {
        // Common years come only from A; an explicitly named person's ages must match those years.
        const ages = f.marriage.candidates.filter(c => years.includes(c.year)).map(c => c.nominalAge);
        const values = r.year ? years : ages;
        return values.length > 0 && (single ? values.includes(r.lo) : r.lo === Math.min(...values) && r.hi === Math.max(...values));
      }
      const w = f.whitelist;
      return single && (r.year ? w.years : w.ages).includes(r.lo);
    });
    valid &&= r.lo <= r.hi;
    if (!valid) add('age-not-in-facts', r.start, r.end, '年龄或年份不在所属人物的本题事实/候选范围内');
  }
  const hasMarriage = /\{\{MARRIAGE_(?:RANGE|YEARS)\}\}/.test(text) || refs.some(r => r.year ? years.includes(r.lo) && years.includes(r.hi) : cs.some(c => c.nominalAge === r.lo) && cs.some(c => c.nominalAge === r.hi));
  if (isMarriageTimingQuestion(question) && !facts.marriage.unavailable && !hasMarriage) add('marriage-no-candidate', 0, first.length, '婚期问题未使用任何固定候选，请用婚期占位符补充');
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
