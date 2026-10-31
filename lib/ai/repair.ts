import { repairFactsToText } from './facts';
import { deleteSentences, filterDisclaimers, scrubInternalTerms, scrubUnknownTime } from './disclaimer';
import { fillPlaceholders } from './postprocess';
import { firstSentence } from './jargon';
import { logIssues, validateAnswer, type AnswerIssue, type ValidationInput } from './validate';

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
  let result = '', cursor = 0;
  const deletions: { start: number; end: number }[] = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i], value = replacements[i];
    result += text.slice(cursor, target.start);
    const valid = typeof value === 'string' && value.length <= target.text.length;
    if (valid && !value.trim()) deletions.push({ start: result.length, end: result.length + target.text.length });
    result += valid && value.trim() ? value.trim() : target.text;
    cursor = target.end;
  }
  return deleteSentences(result + text.slice(cursor), deletions);
}
export function codeRepair(input: ValidationInput, numericFallback = true): string {
  let text = filterDisclaimers(fillPlaceholders(input.text, input.facts));
  if (numericFallback) {
    const issues = validateAnswer({ ...input, text });
    // Never splice a marriage/health envelope into a person's basic age. Drop the untrusted
    // sentence as a unit, leaving neighbouring analysis intact; coalesce multiple bad references.
    text = deleteSentences(text, issues.filter(i => i.type === 'age-not-in-facts'));
    if (validateAnswer({ ...input, text }).some(i => i.type === 'marriage-no-candidate')) {
      text += `\n\n婚期以${input.facts.subjects ? '甲方' : ''}${input.facts.marriage.rangeText}为主，重点在${input.facts.marriage.years.join('、')}年。`;
    }
  }
  // Final insurance also applies after placeholders, rewrites, and deterministic additions.
  return scrubUnknownTime(scrubInternalTerms(filterDisclaimers(text)), input.facts);
}
export type Rewriter = (targets: RepairTarget[], factsText: string, timeoutMs: number, signal?: AbortSignal) => Promise<string[]>;
/** One batch call max, never regenerate the whole answer. Insufficient time => deterministic fallback. */
export async function repairAnswer(input: ValidationInput, options: { deadline: number; rewrite: Rewriter; now?: () => number; signal?: AbortSignal }): Promise<string> {
  const now = options.now ?? Date.now;
  const clean = (raw: string) => {
    let unknown = 0;
    const filled = fillPlaceholders(raw, input.facts, () => { unknown++; });
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
