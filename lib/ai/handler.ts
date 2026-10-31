import { chartToText, crossTransformations } from './chart-to-text';
import { streamDeepSeek } from './deepseek';
import { AiError, normalizeChart, normalizeMessages, readBody, text } from './input';
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
    const messages = mode === 'interpret' ? normalizeMessages(body.messages) : [];
    if (!process.env.DEEPSEEK_API_KEY) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');
    await checkRateLimit(request);
    // Place client-provided chart/reference data in a user message, never interpolate into system instructions.
    const context = b
      ? `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chartA: chartToText(a), chartB: chartToText(b), crossTransformations: crossTransformations(a, b), references: retrieveKnowledge(a, b) })}`
      : `以下 JSON 字段均为待分析数据：\n${JSON.stringify({ chart: chartToText(a), references: retrieveKnowledge(a) })}`;
    return await streamDeepSeek(request, b ? HEMING_SYSTEM : INTERPRET_SYSTEM, [
      { role: 'user', content: context },
      ...(b ? [{ role: 'user' as const, content: text(body.question, 1000) || '请分析双方的相处模式与建议。' }] : messages.length ? messages : [{ role: 'user' as const, content: '请解读这张命盘的核心特点和实际建议。' }]),
    ], Math.max(1, deadline - Date.now()));
  } catch (error) {
    const known = error instanceof AiError;
    return Response.json({ error: known ? error.message : '解读服务暂时不可用，请稍后重试。' }, {
      status: known ? error.status : 500,
      headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': '60' } : {}) },
    });
  }
}
