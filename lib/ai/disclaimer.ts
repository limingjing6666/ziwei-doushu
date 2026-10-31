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
