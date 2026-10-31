import { chartToText, crossTransformations, viewToText, isHealthQuestion } from './chart-to-text';
import { streamDeepSeek } from './deepseek';
import { buildAgeFacts } from '@/lib/ziwei/facts';
import { glossaryForChart } from '@/lib/glossary';
import { AiError, normalizeChart, normalizeMessages, normalizeView, readBody, text } from './input';
import { retrieveKnowledge } from './knowledge';
import { INTERPRET_SYSTEM, HEMING_SYSTEM, systemForTime } from './prompts';
import { checkOrigin, checkRateLimit } from './rate-limit';
import { AiTelemetry } from './telemetry';

export async function handleAi(request: Request, mode: 'interpret' | 'heming'): Promise<Response> {
  // Leave 3 seconds before the routes' 60-second limit for stream cleanup/errors.
  const deadline = Date.now() + 57000;
  const telemetry = new AiTelemetry(mode);
  try {
    checkOrigin(request);
    const body = await readBody(request);
    const a = normalizeChart(mode === 'interpret' ? body.chart : body.chartA);
    const b = mode === 'heming' ? normalizeChart(body.chartB) : undefined;
    if (body.birthTimeKnown === false) a.birthInfo.birthTimeKnown = false;
    const viewA = normalizeView(body.view ?? body.viewA ?? (a.liunianYear ? { year: a.liunianYear } : undefined), a);
    const viewB = b ? normalizeView(body.viewB ?? (b.liunianYear ? { year: b.liunianYear } : undefined), b) : undefined;
    a.liunianYear = viewA.year;
    if (b) b.liunianYear = viewB!.year;
    const messages = normalizeMessages(body.messages);
    const scenario = b ? (body.mode === 'followup' ? 'followup' : 'overview') : body.mode === 'detail' ? 'detail' : body.mode === 'overview' ? 'overview' : 'followup';
    telemetry.context(scenario, a.birthInfo.birthTimeKnown !== false);
    const maxTokens = scenario === 'overview' ? 2400 : scenario === 'detail' ? 1800 : 2200;
    const lengthRule = scenario === 'overview'
      ? '总览或专题700–900汉字，硬上限1000字。'
      : scenario === 'detail' ? '单项解读400–700汉字。' : '追问400–800汉字，不重写原报告。';
    if (!process.env.DEEPSEEK_API_KEY) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');
    await checkRateLimit(request);
    const question = `${text(body.topic, 40)} ${text(body.question, 1000) || [...messages].reverse().find(m => m.role === 'user')?.content || ''}`;
    const now = new Date(), currentYear = now.getFullYear();
    const currentDate = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const factsA = buildAgeFacts(a, { currentYear, currentDate, selectedYear: viewA.year });
    const factsB = b ? buildAgeFacts(b, { currentYear, currentDate, selectedYear: viewB!.year }) : undefined;
    // A is the single marriage candidate source in compatibility mode, not a spliced third range.
    if (factsB && !factsB.birthTimeKnown) factsA.marriage = { unavailable: true, reason: '乙方出生时辰未知', rangeText: '', years: [], candidates: [] };
    const chartA = chartToText(a, { facts: factsA, question });
    const chartB = b ? chartToText(b, { facts: factsB, question: isHealthQuestion(question) ? '健康' : '' }) : undefined;
    const references = retrieveKnowledge(a, b);
    // Place client-provided chart/reference data in a user message, never interpolate into system instructions.
    const context = b
      ? `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chartA, chartB, selectedViewA: viewToText(viewA, a), selectedViewB: viewToText(viewB, b), reportSummary: text(body.reportSummary, 1600), crossTransformations: crossTransformations(a, b), references, glossary: glossaryForChart(`${chartA}\n${chartB}\n${references}`) })}`
      : `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chart: chartA, selectedView: viewToText(viewA, a), references, glossary: glossaryForChart(`${chartA}\n${references}`) })}`;
    const upstream = await streamDeepSeek(request, `${systemForTime(b ? HEMING_SYSTEM : INTERPRET_SYSTEM, a.birthInfo.birthTimeKnown === false || b?.birthInfo.birthTimeKnown === false)}\n【本次篇幅硬约束】${lengthRule}`, [
      { role: 'user', content: context },
      ...(b ? [...messages, { role: 'user' as const, content: text(body.question, 1000) || '请分析双方的相处模式与建议。' }] : messages.length ? messages : [{ role: 'user' as const, content: text(body.question, 1000) || '请解读这张命盘的核心特点和实际建议。' }]),
    ], Math.max(1, deadline - Date.now()), maxTokens, telemetry);
    return telemetry.response(upstream);
  } catch (error) {
    telemetry.error(error);
    const known = error instanceof AiError;
    return telemetry.response(Response.json({ error: known ? error.message : '解读服务暂时不可用，请稍后重试。', ...(known && error.status === 429 ? { retryAfter: error.retryAfter ?? 60, limitKind: error.limitKind ?? 'minute' } : {}) }, {
      status: known ? error.status : 500,
      headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': String(error.retryAfter ?? 60) } : {}) },
    }));
  }
}
