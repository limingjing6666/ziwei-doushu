import { chartToText, crossTransformations, viewToText } from './chart-to-text';
import { streamDeepSeek } from './deepseek';
import { AiError, normalizeChart, normalizeMessages, normalizeView, readBody, text } from './input';
import { retrieveKnowledge } from './knowledge';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from './prompts';
import { checkOrigin, checkRateLimit } from './rate-limit';

export async function handleAi(request: Request, mode: 'interpret' | 'heming'): Promise<Response> {
  const deadline = Date.now() + 55000;
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
    const maxTokens = scenario === 'overview' ? 1600 : scenario === 'detail' ? 500 : 600;
    const lengthRule = scenario === 'overview' ? '整份解读不超过1000字，主动收束并写完整结尾。' : '本次只简答当前问题，200–300字，不重写总览或原报告。';
    if (!process.env.DEEPSEEK_API_KEY) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');
    await checkRateLimit(request);
    // Place client-provided chart/reference data in a user message, never interpolate into system instructions.
    const context = b
      ? `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chartA: chartToText(a), chartB: chartToText(b), selectedViewA: viewToText(viewA, a), selectedViewB: viewToText(viewB, b), reportSummary: text(body.reportSummary, 1600), crossTransformations: crossTransformations(a, b), references: retrieveKnowledge(a, b) })}`
      : `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chart: chartToText(a), selectedView: viewToText(viewA, a), references: retrieveKnowledge(a) })}`;
    return await streamDeepSeek(request, `${b ? HEMING_SYSTEM : INTERPRET_SYSTEM}\n【本次篇幅硬约束】${lengthRule}`, [
      { role: 'user', content: context },
      ...(b ? [...messages, { role: 'user' as const, content: text(body.question, 1000) || '请分析双方的相处模式与建议。' }] : messages.length ? messages : [{ role: 'user' as const, content: '请解读这张命盘的核心特点和实际建议。' }]),
    ], Math.max(1, deadline - Date.now()), maxTokens);
  } catch (error) {
    const known = error instanceof AiError;
    return Response.json({ error: known ? error.message : '解读服务暂时不可用，请稍后重试。', ...(known && error.status === 429 ? { retryAfter: error.retryAfter ?? 60, limitKind: error.limitKind ?? 'minute' } : {}) }, {
      status: known ? error.status : 500,
      headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': String(error.retryAfter ?? 60) } : {}) },
    });
  }
}
