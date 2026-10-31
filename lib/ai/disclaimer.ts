import { JARGON_TERMS, UNKNOWN_TIME_OPENING } from './jargon';
import type { AnswerFacts } from './facts';

/** Sentence-level output policy. Deliberately match reminder constructions, not words such
 * as 参考 / 医院 / 就医 in ordinary analysis or quotations. Keep additions here testable. */
export interface TextSpan { start: number; end: number }
export function sentenceSpans(text: string): TextSpan[] {
  return [...text.matchAll(/[^。！？!?\n]+[。！？!?]*[”」』"]*|[。！？!?]+/g)]
    .map(m => ({ start: m.index!, end: m.index! + m[0].length }));
}
const INTRO = '(?:以上(?:内容|分析|解读|判断|断语)|本(?:次)?(?:内容|分析|解读|判断|回答)|这些(?:内容|分析|断语))';
export const DISCLAIMER_PATTERNS: readonly RegExp[] = [
  /^命理(?:只是|只作|仅作|仅供|仅是|仅为|只供)?参考/,
  /^(?:以上|上述)(?:仅供|仅作|只作|只供)参考/,
  new RegExp(`^(?:${INTRO}[，,：:]?)?(?:仅供|仅作|只供|只作|仅为|只是)参考`),
  new RegExp(`^(?:${INTRO}[，,：:]?)?不构成[^。！？]*建议`),
  /^(?:若|如|如果)?(?:有|出现)?身体不适[，,]?(?:请|应|需|建议)(?:及时)?就医/,
  /^(?:请|建议)(?:你|您)?(?:及时)?(?:咨询|就诊于|求助于)(?:专业)?(?:医生|医师)/,
  /^(?:请|建议)(?:及时)?就医/,
  /^具体选择(?:还)?看你自己/,
  /^(?:请)?结合(?:你的)?(?:实际情况|现实(?:沟通与相处情况)?)(?:再)?(?:决定|判断|选择|作选择)?/,
  /^(?:请)?理性(?:看待|对待)/,
  /^(?:请)?切勿迷信/,
  /^(?:传统(?:象义|疾厄(?:倾向|断法|判断)?)|命理(?:分析|解读|判断)?)[^。！？]*(?:(?:不是|并非)(?:科学事实|命运保证|医学诊断)|不构成[^。！？]*建议)/,
  /^古籍[^。！？]*不是收益保证/,
  new RegExp(`^(?:(?:${INTRO}|此|这(?:些)?(?:是)?)[，,：:]?)?(?:并非|不是|不属于)医学诊断`),
  /^(?:健康|疾厄)(?:方面的)?(?:解读|分析|判断|论断)[^。！？]*(?:(?:不是|并非)医学诊断|仅作观察线索|不构成[^。！？]*建议)/,
  /^(?:此|这)(?:为|是)倾向[，,]?(?:而)?非定论/,
  new RegExp(`^${INTRO}[^。！？]*(?:倾向[^。！？]*(?:非定论|并非定论)|不是收益保证)`),
  /^(?:以上[^，,。！？]*[，,]?)?仅作(?:生活)?观察线索/,
  /^(?:你|您|双方|甲方|乙方)?(?:有)?(?:可能|或许|倾向于)/,
  /^(?:你|您|双方|甲方|乙方|感情|婚姻|健康|事业|财运|体质)[^，,。！？“”「」『』"]{0,12}(?:(?<!不)可能|或许|倾向于)/,
  /[，,；;](?:可能|或许|倾向于)/,
];
// These are model meta-commentary, never a replacement for unverifiable claims.
export const META_PATTERN = /(?:这一点)?(?:目前|暂时|暂)?无法(?:确定|判断)|暂无法|资料不足/;
function statement(text: string) {
  return text.trim().replace(/^(?:#{1,6}\s*|[-*>]\s*|\d+[.、]\s*)/, '')
    .replace(/^\*\*/, '').replace(/^(?:甲方|乙方|[AB]方?)\s*[：:]\s*/i, '');
}
export function disclaimerSpans(text: string): TextSpan[] {
  return sentenceSpans(text).filter(s => {
    const value = statement(text.slice(s.start, s.end));
    return META_PATTERN.test(value) || DISCLAIMER_PATTERNS.some(p => p.test(value));
  });
}
/** Delete whole statements; repair only the transition immediately after a deletion. */
export function deleteSentences(text: string, spans: TextSpan[]): string {
  if (!spans.length) return text.trim();
  const sentences = sentenceSpans(text);
  let result = '', cursor = 0, gap = false, removedSubject = '';
  for (const sentence of sentences) {
    const removed = spans.some(s => s.start < sentence.end && s.end > sentence.start);
    const separator = text.slice(cursor, sentence.start);
    cursor = sentence.end;
    if (removed) {
      gap = true;
      removedSubject = [...text.slice(sentence.start, sentence.end).matchAll(/甲方|乙方|\b[AB]方?\b/gi)].at(-1)?.[0] ?? removedSubject;
      continue;
    }
    let value = text.slice(sentence.start, sentence.end);
    // Deleting a labelled bad age must not reassign the following valid age to the
    // preceding person. Attach the identity to content, never leave an orphan label.
    if (removedSubject && !/甲方|乙方|\b[AB]方?\b/i.test(value) && /\d[^。！？]*(?:岁|年)|(?:虚岁|公历)\s*\d|\{\{HEALTH_YEARS\}\}/.test(value)) {
      value = `${removedSubject}：${value.trimStart()}`;
    }
    if (/甲方|乙方|\b[AB]方?\b/i.test(value)) removedSubject = '';
    if (gap) {
      value = value.replace(/^(\s*(?:[-*]\s*|\d+[.、]\s*)?(?:(?:甲方|乙方|[AB]方?)\s*[：:]\s*)?)(?:(?:因此|所以|同时|另外)[，,：:\s]*)+/i, '$1');
      // An identity-only line must not consume the transition flag.
      if (!/^\s*#{1,6}\s+/.test(value) && !/^(?:\s|[*#-])*(?:甲方|乙方|[AB]方?)\s*[：:]?\s*$/i.test(value)) gap = false;
    }
    result += separator + value;
  }
  return (result + text.slice(cursor))
    .replace(/^[\t ]*(?:#{1,6}\s*|\*\*)?(?:甲方|乙方|[AB]方?)\s*[：:](?:\*\*)?[\t ]*$/gim, '')
    .replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, '\n\n').trim();
}
export function filterDisclaimers(text: string): string {
  return deleteSentences(text, disclaimerSpans(text));
}

/** No replace frame exists in the SSE protocol. Retain ~120 trailing characters and
 * any unfinished sentence; only release complete, sanitized sentence prefixes.
 * A long unpunctuated sentence stays buffered rather than leaking an undeletable prefix. */
export function createSentenceWindow(transform: (text: string) => string, tailChars = 120) {
  let raw = '', emitted = '', processed = 0;
  const drain = (final: boolean) => {
    const boundary = final ? raw.length : [...raw.matchAll(/[。！？!?]+[”」』"]*/g)]
      .map(m => m.index! + m[0].length).filter(end => end <= raw.length - tailChars).at(-1) ?? 0;
    if (!final && boundary <= processed) return '';
    const clean = transform(raw.slice(0, boundary));
    // Prefix transforms operate on complete sentences only: sent text is immutable.
    if (!clean.startsWith(emitted)) throw new Error('unstable sentence transform');
    const out = clean.slice(emitted.length);
    emitted = clean; processed = boundary;
    return out;
  };
  return { push(chunk: string) { raw += chunk; return drain(false); }, finish() { return drain(true); } };
}

// Single-letter palace shorthand only in unmistakably technical constructions.
const UNKNOWN_PALACE = /命宫|身宫|财帛|官禄|夫妻|福德|迁移|疾厄|田宅|子女宫|父母宫|兄弟宫|仆役|交友宫|[命身财官福迁疾田子父兄友仆]宫|(?:入|坐|守|落|夹)[命身财官福迁疾田子父兄友仆](?![\u4e00-\u9fff])|[命财官福迁疾田子父兄友仆][、/][命财官福迁疾田子父兄友仆]|大限|格局|入庙|落陷|庙旺|五行局|命主|身主/;
const PATTERN_NAMES = [...JARGON_TERMS.slice(JARGON_TERMS.indexOf('君臣庆会')), '昌曲同会', '辅弼同会', '魁钺同会', '科权双会'];
const PALACE_SHORTHAND = new RegExp(`(?:[命身财官福迁疾田子父兄友仆]|子女|父母|兄弟|交友)(?:坐|守|有|见|为|得|逢|遇|主|入|落|在|见到|坐守)?(?:宫|星|${JARGON_TERMS.slice(JARGON_TERMS.indexOf('紫微'), JARGON_TERMS.indexOf('君臣庆会')).join('|')})|[命财官福迁疾田子父兄友仆]{3,}|(?:化[禄权科忌]|星曜)(?:入|坐|守|落)[命身财官福迁疾田子父兄友仆]`);
export function scrubUnknownTime(text: string, facts: AnswerFacts): string {
  if (facts.birthTimeKnown !== false) return text;
  return deleteSentences(text, sentenceSpans(text).filter(span => {
    const value = text.slice(span.start, span.end).trim();
    if (span.start === 0 && value.replace(/[。！？!?]$/, '') === UNKNOWN_TIME_OPENING) return false;
    if (facts.subjects) {
      // Conservative compatibility guard: only explicit identities, no pronoun inference.
      const { A, B } = facts.subjects;
      if (!((!A.birthTimeKnown && /甲方|A方/.test(value)) || (!B.birthTimeKnown && /乙方|B方/.test(value)))) return false;
    }
    return UNKNOWN_PALACE.test(value) || PALACE_SHORTHAND.test(value) || PATTERN_NAMES.some(name => value.includes(name))
      || /(?:星|曜|太阳|太阴|天机|天同|巨门|武曲|廉贞|贪狼|天梁|天府|天相|七杀|破军|紫微)[^。]{0,6}(?:亮度|庙|旺|陷)/.test(value)
      || /下面只讲|不依赖具体宫位|因出生时辰未知/.test(value);
  }));
}

/** Internal fact-block vocabulary must never reach readers; say the years/range plainly. */
export function scrubInternalTerms(text: string): string {
  // Keep the sentence recognisably about marriage timing so the numeric validator still sees it.
  return text
    .replace(/candidate\s*set/gi, '')
    .replace(/(?:婚期)?(?:候选包络|候选集合?|候选范围|包络)/g, '婚期范围')
    .replace(/(?:婚期)?候选(?:年份|年)/g, '婚期年份')
    .replace(/婚期候选/g, '婚期')
    .replace(/候选/g, '婚期');
}
