import { repairFactsToText, subjectAt } from './facts';
import { fillPlaceholders } from './postprocess';
import { firstSentence } from './jargon';
import { closingFor, closingPattern, logIssues, validateAnswer, type AnswerIssue, type ValidationInput } from './validate';

export const REWRITE_RESERVE_MS = 15000;
export interface RepairTarget { start: number; end: number; text: string; types: string[] }
/** Pure planner: age errors rewrite only their paragraph; jargon only the first sentence.
 * Overlapping spans coalesce so replacements never overwrite each other. */
export function planRepairs(text: string, issues: AnswerIssue[]): RepairTarget[] {
  const targets = issues.filter(i => ['age-not-in-facts', 'marriage-no-candidate', 'first-sentence-jargon'].includes(i.type)).map(i => {
    let { start, end } = i;
    if (i.type === 'age-not-in-facts') {
      const before = [...text.slice(0, start).matchAll(/\n\s*\n/g)].at(-1);
      start = before ? before.index! + before[0].length : 0;
      const after = /\n\s*\n/.exec(text.slice(end));
      end = after ? end + after.index : text.length;
    }
    return { start, end, text: text.slice(start, end), types: [i.type] };
  }).sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: RepairTarget[] = [];
  for (const t of targets) {
    const last = merged.at(-1);
    if (last && t.start < last.end) { last.end = Math.max(last.end, t.end); last.text = text.slice(last.start, last.end); last.types = [...new Set([...last.types, ...t.types])]; }
    else merged.push(t);
  }
  return merged;
}
export function replaceTargets(text: string, targets: RepairTarget[], replacements: string[]) {
  for (let i = targets.length - 1; i >= 0; i--) {
    const value = replacements[i];
    if (typeof value === 'string' && value.trim() && value.length <= targets[i].text.length) text = text.slice(0, targets[i].start) + value.trim() + text.slice(targets[i].end);
  }
  return text;
}
export function codeRepair(input: ValidationInput, numericFallback = true): string {
  let text = fillPlaceholders(input.text, input.facts).replace(/\{\{[^{}]*(?:\}\}|$)/g, '');
  if (numericFallback) {
    const issues = validateAnswer({ ...input, text });
    // Never splice a marriage/health envelope into a person's basic age. Drop the untrusted
    // sentence as a unit, leaving neighbouring analysis intact; coalesce multiple bad references.
    const spans: { start: number; end: number }[] = [];
    for (const issue of issues.filter(i => i.type === 'age-not-in-facts')) {
      const before = [...text.slice(0, issue.start).matchAll(/[。！？\n]/g)].at(-1);
      const after = /[。！？\n]/.exec(text.slice(issue.end));
      const span = { start: before ? before.index! + 1 : 0, end: after ? issue.end + after.index + 1 : text.length };
      const last = spans.at(-1);
      if (last && span.start < last.end) last.end = Math.max(last.end, span.end);
      else spans.push(span);
    }
    for (const span of spans.reverse()) {
      const sentence = text.slice(span.start, span.end);
      const subject = input.facts.subjects && subjectAt(sentence, sentence.length);
      const label = subject ? subject === 'A' ? '甲方：' : '乙方：' : '';
      text = text.slice(0, span.start) + label + '这一点目前无法确定。' + text.slice(span.end);
    }
    if (validateAnswer({ ...input, text }).some(i => i.type === 'marriage-no-candidate')) {
      text += `\n\n可重点观察的候选范围：${input.facts.subjects ? '甲方' : ''}${input.facts.marriage.rangeText}。`;
    }
  }
  const closing = closingFor(text, input.question);
  return `${text.replace(closingPattern(), '').trim()}\n\n${closing}`;
}
export type Rewriter = (targets: RepairTarget[], factsText: string, timeoutMs: number, signal?: AbortSignal) => Promise<string[]>;
/** One batch call max, never regenerate the whole answer. Insufficient time => deterministic fallback. */
export async function repairAnswer(input: ValidationInput, options: { deadline: number; rewrite: Rewriter; now?: () => number; signal?: AbortSignal }): Promise<string> {
  const now = options.now ?? Date.now;
  const clean = (raw: string) => {
    let unknown = 0;
    const filled = fillPlaceholders(raw, input.facts, () => { unknown++; });
    unknown += (filled.match(/\{\{[^{}]*$/g) ?? []).length;
    if (unknown) console.warn('[ai-consistency]', { 'placeholder-left': unknown });
    return codeRepair({ ...input, text: filled }, false);
  };
  let text = clean(input.text);
  const issues = validateAnswer({ ...input, text }); logIssues(issues);
  const originalFirst = firstSentence(text);
  const targets = planRepairs(text, issues);
  if (targets.length && !options.signal?.aborted && options.deadline - now() >= REWRITE_RESERVE_MS) try {
    const replacements = await options.rewrite(targets, repairFactsToText(input.facts, input.question), Math.max(1, options.deadline - now() - 1000), options.signal);
    options.signal?.throwIfAborted();
    text = replaceTargets(text, targets, replacements);
    text = clean(text);
  } catch { /* No private provider errors/user text in telemetry; deterministic safe fallback. */ }
  if (validateAnswer({ ...input, text }).some(i => i.type === 'first-sentence-jargon')) text = originalFirst + text.slice(firstSentence(text).length);
  const result = codeRepair({ ...input, text });
  logIssues(validateAnswer({ ...input, text: result }));
  return result;
}
