import { randomUUID } from 'node:crypto';
import { AiError, type ChatMessage } from './input';
import type { ModelSelection } from './model-config';
import { encodeDelta, readSseData } from './sse';
import type { AiTelemetry } from './telemetry';

const SESSION_ID = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function resolveAiProvider(selection: ModelSelection, request: Request, configuredKey?: string) {
  const useOpenCodeGo = selection.provider === 'opencode-go';
  const key = configuredKey ?? (useOpenCodeGo ? process.env.OPENCODE_GO_API_KEY : process.env.DEEPSEEK_API_KEY);
  if (!key) throw new AiError(500, 'AI 解读服务尚未配置，请稍后再试。');

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const { model, effort } = selection;
  const thinkingOptions: { thinking?: { type: 'enabled' | 'disabled' }; reasoning_effort?: string } = {};
  let url = 'https://api.deepseek.com/chat/completions';

  if (useOpenCodeGo) {
    url = 'https://opencode.ai/inference/go/openai/v1/chat/completions';
    const clientSession = request.headers.get('x-opencode-session');
    headers['User-Agent'] = 'Tianjipan/1.0';
    headers['X-OpenCode-Session'] = clientSession && SESSION_ID.test(clientSession) ? clientSession : randomUUID();
    if (effort !== 'default') thinkingOptions.reasoning_effort = effort;
  } else if (effort === 'none' || (effort === 'default' && model === 'deepseek-flash')) {
    // Keep the default Flash budget available for the visible reading.
    thinkingOptions.thinking = { type: 'disabled' };
  } else if (effort !== 'default') {
    thinkingOptions.thinking = { type: 'enabled' };
    thinkingOptions.reasoning_effort = effort;
  }

  return { url, headers, model, thinkingOptions, reasoningTokens: effort !== 'default' && effort !== 'none' ? 2048 : 0 };
}

export async function streamDeepSeek(request: Request, system: string, messages: ChatMessage[], timeoutMs = 55000, maxTokens = 2400, telemetry?: AiTelemetry): Promise<Response> {
  const provider = resolveAiProvider({ provider: 'deepseek', model: process.env.DEEPSEEK_MODEL || 'deepseek-flash', effort: 'default' }, request);
  return streamAi(provider, request, system, messages, timeoutMs, maxTokens, telemetry);
}

export async function streamAi(provider: ReturnType<typeof resolveAiProvider>, request: Request, system: string, messages: ChatMessage[], timeoutMs: number, maxTokens: number, telemetry?: AiTelemetry): Promise<Response> {
  const abort = new AbortController();
  const onAbort = () => abort.abort();
  request.signal.addEventListener('abort', onAbort, { once: true });
  if (request.signal.aborted) abort.abort();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener('abort', onAbort); };
  let upstream: Response;
  telemetry?.begin();
  try {
    upstream = await fetch(provider.url, {
      method: 'POST', headers: provider.headers,
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        stream_options: { include_usage: true },
        ...provider.thinkingOptions,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens + provider.reasoningTokens,
      }),
      signal: abort.signal, cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body) {
      telemetry?.upstreamError(upstream.status);
      await upstream.body?.cancel();
      const status = upstream.status === 429 ? 503 : 502;
      throw new AiError(status, upstream.status === 429 ? 'AI 服务繁忙，请稍后再试。' : 'AI 服务暂时无法响应，请稍后重试。');
    }
  } catch (error) {
    cleanup();
    abort.abort();
    if (error instanceof AiError) throw error;
    telemetry?.upstreamError();
    throw new AiError(504, 'AI 服务连接超时或中断，请稍后重试。');
  }
  const source = readSseData(upstream.body!, abort.signal);
  const encoder = new TextEncoder();
  let cancelled = false;
  let hasContent = false;
  let lengthReached = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!cancelled) {
          const { done, value } = await source.next();
          if (done && !lengthReached) throw new Error('upstream ended without DONE');
          if (value === '[DONE]' || (done && lengthReached)) {
            if (!hasContent) throw new Error('upstream returned no content');
            if (lengthReached) controller.enqueue(encoder.encode('data: {"finish_reason":"length"}\n\n'));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            cleanup();
            await source.return(undefined).catch(() => {});
            return;
          }
          const chunk = JSON.parse(value);
          if (chunk.error) throw new Error('upstream stream error');
          const reason = chunk.choices?.[0]?.finish_reason;
          telemetry?.consume(chunk.usage, reason);
          if (reason && reason !== 'stop' && reason !== 'length') throw new Error('upstream response incomplete');
          // Some providers include the final visible delta and finish_reason together.
          const content = chunk.choices?.[0]?.delta?.content;
          if (typeof content === 'string' && content) {
            hasContent = true;
            telemetry?.token();
            controller.enqueue(encoder.encode(encodeDelta(content)));
          }
          if (reason === 'length') lengthReached = true;
          // Only visible content: reasoning_content is deliberately ignored.
          if (typeof content === 'string' && content) return;
        }
      } catch {
        telemetry?.upstreamError();
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
