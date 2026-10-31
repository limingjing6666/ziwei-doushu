import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';

export class AiError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number, public limitKind?: 'minute' | 'daily') { super(message); }
}
export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export const text = (x: unknown, max = 100) => typeof x === 'string' ? x.slice(0, max) : '';
const num = (x: unknown, fallback = -1) => typeof x === 'number' && Number.isFinite(x) ? x : fallback;
const index = (x: unknown, max: number) => Number.isInteger(x) && num(x) >= 0 && num(x) < max ? num(x) : -1;
const palaceNames = new Set(['命', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '仆役', '官禄', '田宅', '福德', '父母']);
const palaceName = (x: unknown) => typeof x === 'string' && palaceNames.has(x.replace(/宫$/, '')) ? x : '未知宫';
const age = (x: unknown) => Number.isInteger(x) && num(x) >= 0 && num(x) <= 150;
const list = (x: unknown, max: number) => Array.isArray(x) ? x.slice(0, max).filter(isObject) : [];
const sihua = (x: unknown) => ['禄', '权', '科', '忌'].includes(text(x)) ? x as Star['siHua'] : undefined;

/** Only copy known fields; partial charts are supported, malformed nested values cannot crash RAG. */
export function normalizeChart(raw: unknown): ZiweiChart & { liunianYear?: number } {
  if (!isObject(raw)) throw new AiError(400, '请提供有效的命盘对象。');
  const birth = isObject(raw.birthInfo) ? raw.birthInfo : {};
  const lunar = isObject(raw.lunarInfo) ? raw.lunarInfo : {};
  const palaces: Palace[] = list(raw.palaces, 12).map(p => ({
    name: palaceName(p.name), branch: index(p.branch, 12), stem: index(p.stem, 10),
    stars: list(p.stars, 60).map(s => ({
      name: text(s.name, 20),
      type: ['major', 'lucky', 'sha', 'minor'].includes(text(s.type)) ? s.type as Star['type'] : 'minor',
      brightnessRaw: ['庙', '旺', '得', '利', '平', '不', '闲', '陷', '地'].includes(text(s.brightnessRaw)) ? s.brightnessRaw as Star['brightnessRaw'] : undefined,
      brightness: ['bright', 'normal', 'dim'].includes(text(s.brightness)) ? s.brightness as Star['brightness'] : undefined,
      siHua: sihua(s.siHua),
    })),
    isShenGong: p.isShenGong === true, isMingGong: p.isMingGong === true,
    isCurrentDaXian: p.isCurrentDaXian === true,
    daXianAge: Array.isArray(p.daXianAge) && p.daXianAge.length === 2 ? [num(p.daXianAge[0]), num(p.daXianAge[1])] : undefined,
    selfSihua: list(p.selfSihua, 4).filter(s => sihua(s.siHua)).map(s => ({ starName: text(s.starName, 20), siHua: sihua(s.siHua)! })),
  }));
  const chart = {
    birthInfo: { year: num(birth.year), month: num(birth.month), day: num(birth.day), hour: index(birth.hour, 12),
      birthTimeKnown: birth.birthTimeKnown === false || raw.birthTimeKnown === false ? false : true,
      // Unknown gender must not silently become male.
      gender: birth.gender === 'male' || birth.gender === 'female' ? birth.gender : undefined,
      origInput: isObject(birth.origInput) ? { year: num(birth.origInput.year), month: num(birth.origInput.month), day: num(birth.origInput.day), clockHour: num(birth.origInput.clockHour), clockMinute: num(birth.origInput.clockMinute) } : undefined },
    lunarInfo: { lunarYear: num(lunar.lunarYear), lunarMonth: num(lunar.lunarMonth), lunarDay: num(lunar.lunarDay), yearStem: index(lunar.yearStem, 10), yearBranch: index(lunar.yearBranch, 12), isLeapMonth: lunar.isLeapMonth === true },
    mingGongBranch: index(raw.mingGongBranch, 12), shenGongBranch: index(raw.shenGongBranch, 12),
    wuxingJu: num(raw.wuxingJu), wuxingJuName: text(raw.wuxingJuName, 20),
    mingZhu: text(raw.mingZhu, 20), shenZhu: text(raw.shenZhu, 20), yinYangGender: text(raw.yinYangGender, 10),
    ziweiPos: index(raw.ziweiPos, 12), palaces,
    liunianYear: typeof raw.liunianYear === 'number' && Number.isInteger(raw.liunianYear) && raw.liunianYear >= 1800 && raw.liunianYear <= 2200 ? raw.liunianYear : undefined,
    currentAge: num(raw.currentAge), currentDaXianIndex: index(raw.currentDaXianIndex, 12),
    daXians: list(raw.daXians, 12).map(d => ({ startAge: num(d.startAge), endAge: num(d.endAge), palaceBranch: index(d.palaceBranch, 12), palaceName: palaceName(d.palaceName) })),
  };
  return chart as ZiweiChart;
}

export interface AiView {
  type: 'natal' | 'decadal' | 'yearly';
  year: number;
  decadal?: { startAge: number; endAge: number; palaceName: string; stem: number };
}
/** Ignore unknown fields, never accept client-provided instructions as a view. */
export function normalizeView(raw: unknown, chart: ZiweiChart, currentYear = new Date().getFullYear()): AiView {
  const v = isObject(raw) ? raw : {};
  const dx = isObject(v.decadal) ? v.decadal : undefined;
  const year = Number.isInteger(v.year) && num(v.year) >= 1900 && num(v.year) <= 2100 ? num(v.year) : currentYear;
  const current = chart.daXians[chart.currentDaXianIndex];
  const stem = current ? chart.palaces.find(p => p.branch === current.palaceBranch)?.stem : undefined;
  return { type: ['natal', 'decadal', 'yearly'].includes(text(v.type)) ? v.type as AiView['type'] : 'yearly', year,
    decadal: dx && age(dx.startAge) && age(dx.endAge) && num(dx.endAge) >= num(dx.startAge) && index(dx.stem, 10) >= 0 && palaceName(dx.palaceName) !== '未知宫'
      ? { startAge: num(dx.startAge), endAge: num(dx.endAge), palaceName: palaceName(dx.palaceName), stem: index(dx.stem, 10) }
      : current && age(current.startAge) && age(current.endAge) && current.endAge >= current.startAge && index(stem, 10) >= 0 ? { startAge: current.startAge, endAge: current.endAge, palaceName: palaceName(current.palaceName), stem: stem! } : undefined };
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export function normalizeMessages(raw: unknown): ChatMessage[] {
  if (raw !== undefined && !Array.isArray(raw)) throw new AiError(400, '对话 messages 必须是数组。');
  return (Array.isArray(raw) ? raw : []).filter(isObject)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12).map(m => ({ role: m.role as ChatMessage['role'], content: text(m.content, 2000) }));
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const max = 200 * 1024;
  if (Number(request.headers.get('content-length')) > max) throw new AiError(413, '请求内容过大，请减少对话内容后重试。');
  if (!request.body) throw new AiError(400, '请求内容不能为空。');
  const reader = request.body.getReader();
  // Bound slow/stalled uploads as well as their size, and release on disconnect.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new AiError(408, '请求读取超时或中断，请重试。');
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new AiError(413, '请求内容过大，请减少对话内容后重试。'); }
      parts.push(value);
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!isObject(value)) throw new Error();
    return value;
  } catch { throw new AiError(400, '请求 JSON 格式不正确。'); }
}
