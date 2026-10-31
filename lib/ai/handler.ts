import { chartToText, crossTransformations, viewToText, isNumericSensitive, isHealthQuestion } from './chart-to-text';
import { streamDeepSeek, deepSeekRewriter } from './deepseek';
import { buildAgeFacts } from '@/lib/ziwei/facts';
import { compatibilityFacts } from './facts';
import { glossaryForChart } from '@/lib/glossary';
import { consistencyStream } from './consistency-stream';
import { AiError, normalizeChart, normalizeMessages, normalizeView, readBody, text } from './input';
import { retrieveKnowledge } from './knowledge';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from './prompts';
import { checkOrigin, checkRateLimit } from './rate-limit';

export async function handleAi(request: Request, mode: 'interpret' | 'heming'): Promise<Response> {
  // Leave 3 seconds before the routes' 60-second limit for stream cleanup/errors.
  const deadline = Date.now() + 57000;
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
    const maxTokens = scenario === 'overview' ? 3200 : scenario === 'detail' ? 1800 : 2200;
    const lengthRule = (scenario === 'overview'
      ? b ? '合盘总览目标700–1000汉字，最多1200字。' : '整盘总览目标700–1200汉字，最多1400字；独立健康/感情/婚姻/事业专题600–1000字，详细给出宫位星曜依据和数据支持的时间点。'
      : scenario === 'detail' ? '单项解读目标400–700汉字，充分展开所选宫位/星曜/四化的依据与建议。'
        : `追问目标400–800汉字，充分回答当前问题并给足依据${b ? '，不重写原报告' : ''}。`)
      + '第一句直接回答（时辰未知固定首句优先），术语首次出现括号解释；接近上限主动收束，在最后一条依据或建议处自然结束，全文及结尾不得写免责、提醒或无法判断等元话语。';
    if (!process.env.DEEPSEEK_API_KEY) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');
    await checkRateLimit(request);
    const question = `${text(body.topic, 40)} ${text(body.question, 1000) || [...messages].reverse().find(m => m.role === 'user')?.content || ''}`;
    const now = new Date(), currentYear = now.getFullYear();
    const currentDate = `${currentYear}-${now.getMonth() + 1}-${now.getDate()}`;
    const factsA = buildAgeFacts(a, { currentYear, currentDate, selectedYear: viewA.year });
    const factsB = b ? buildAgeFacts(b, { currentYear, currentDate, selectedYear: viewB!.year }) : undefined;
    // A is the single marriage candidate source in compatibility mode, not a spliced third range.
    if (factsB && !factsB.birthTimeKnown) factsA.marriage = { unavailable: true, reason: '乙方出生时辰未知', rangeText: '', years: [], candidates: [] };
    const facts = factsB ? compatibilityFacts(factsA, factsB) : factsA;
    const chartA = chartToText(a, { facts: factsA, question });
    const chartB = b ? chartToText(b, { facts: factsB, question: isHealthQuestion(question) ? '健康' : '' }) : undefined;
    const references = retrieveKnowledge(a, b);
    // Place client-provided chart/reference data in a user message, never interpolate into system instructions.
    const context = b
      ? `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chartA, chartB, selectedViewA: viewToText(viewA, a), selectedViewB: viewToText(viewB, b), reportSummary: text(body.reportSummary, 1600), crossTransformations: crossTransformations(a, b), references, glossary: glossaryForChart(`${chartA}\n${chartB}\n${references}`) })}`
      : `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chart: chartA, selectedView: viewToText(viewA, a), references, glossary: glossaryForChart(`${chartA}\n${references}`) })}`;
    const upstream = await streamDeepSeek(request, `${b ? HEMING_SYSTEM : INTERPRET_SYSTEM}\n【本次篇幅硬约束】${lengthRule}`, [
      { role: 'user', content: context },
      ...(b ? [...messages, { role: 'user' as const, content: text(body.question, 1000) || '请分析双方的相处模式与建议。' }] : messages.length ? messages : [{ role: 'user' as const, content: text(body.question, 1000) || '请解读这张命盘的核心特点和实际建议。' }]),
    ], Math.max(1, deadline - Date.now()), maxTokens);
    return consistencyStream(upstream, { mode: scenario, facts, question }, { buffered: isNumericSensitive(question), deadline, rewrite: deepSeekRewriter(request.signal), signal: request.signal });
  } catch (error) {
    const known = error instanceof AiError;
    return Response.json({ error: known ? error.message : '解读服务暂时不可用，请稍后重试。', ...(known && error.status === 429 ? { retryAfter: error.retryAfter ?? 60, limitKind: error.limitKind ?? 'minute' } : {}) }, {
      status: known ? error.status : 500,
      headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': String(error.retryAfter ?? 60) } : {}) },
    });
  }
}
