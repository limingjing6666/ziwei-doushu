import { AiError, type ChatMessage } from './input';
import { encodeDelta, readSseData } from './sse';

export async function streamDeepSeek(request: Request, system: string, messages: ChatMessage[], timeoutMs = 55000, maxTokens = 2400): Promise<Response> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) abort.abort();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', onAbort); };
  let upstream: Response;
  try {
    upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', stream: true,
        // Keep the bounded budget for the visible reading, not hidden reasoning.
        // Other explicitly configured models retain their own default behavior.
        ...((process.env.DEEPSEEK_MODEL || 'deepseek-flash') === 'deepseek-flash' ? { thinking: { type: 'disabled' } } : {}),
        messages: [{ role: 'system', content: system }, ...messages], max_tokens: maxTokens }),
      signal: abort.signal, cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body) {
      await upstream.body?.cancel();
      const status = upstream.status === 429 ? 503 : 502;
      throw new AiError(status, upstream.status === 429 ? 'AI 服务繁忙，请稍后再试。' : 'AI 服务暂时无法响应，请稍后重试。');
    }
  } catch (error) {
    cleanup();
    abort.abort();
    if (error instanceof AiError) throw error;
    throw new AiError(504, 'AI 服务连接超时或中断，请稍后重试。');
  }
  const source = readSseData(upstream.body!, abort.signal);
  const encoder = new TextEncoder();
  let cancelled = false;
  let hasContent = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!cancelled) {
          const { done, value } = await source.next();
          if (done) throw new Error('upstream ended without DONE');
          if (value === '[DONE]') {
            if (!hasContent) throw new Error('upstream returned no content');
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            cleanup();
            await source.return(undefined).catch(() => {});
            return;
          }
          const chunk = JSON.parse(value);
          if (chunk.error) throw new Error('upstream stream error');
          const reason = chunk.choices?.[0]?.finish_reason;
          if (reason === 'length') {
            controller.enqueue(encoder.encode('data: {"finish_reason":"length"}\n\ndata: [DONE]\n\n'));
            controller.close(); cleanup(); await source.return(undefined).catch(() => {}); return;
          }
          if (reason && reason !== 'stop') throw new Error('upstream response incomplete');
          // Only visible content: reasoning_content is deliberately ignored.
          const content = chunk.choices?.[0]?.delta?.content;
          if (typeof content === 'string' && content) {
            hasContent = true;
            controller.enqueue(encoder.encode(encodeDelta(content)));
            return;
          }
        }
      } catch {
        if (!cancelled && !request.signal.aborted) {
          controller.enqueue(encoder.encode('data: {"error":"解读暂时中断，请稍后重试。"}\n\ndata: [DONE]\n\n'));
          controller.close();
        } else if (!cancelled) controller.close();
        abort.abort();
        cleanup();
        await source.return(undefined).catch(() => {});
      }
    },
    async cancel() {
      cancelled = true;
      abort.abort();
      cleanup();
      await source.return(undefined).catch(() => {});
    },
  });
  return new Response(body, { headers: {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff',
  } });
}
