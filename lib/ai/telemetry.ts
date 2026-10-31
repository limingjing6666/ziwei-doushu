import { randomUUID } from 'node:crypto';
import { syslog } from '../syslog';
export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_cache_hit_tokens?: number; prompt_cache_miss_tokens?: number };
export class AiTelemetry {
  readonly requestId = randomUUID().slice(0,8);
  private start = Date.now();
  private first?: number;
  private upstreamStart = Date.now();
  private upstreamMs = 0;
  private usage: Required<Usage> = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 0 };
  repaired = false;
  truncated = false;
  private finishReason?: string;
  private requested = false;
  constructor(readonly route: 'interpret' | 'heming') {}
  context(mode: string, timeKnown: boolean) { this.requested = true; syslog('info', 'ai.request', { requestId: this.requestId, route: this.route, mode, timeKnown }); }
  begin() { this.upstreamStart = Date.now(); }
  token() { this.first ??= Date.now(); }
  consume(usage?: Usage, reason?: string) {
    if (usage) for (const key of Object.keys(this.usage) as (keyof Usage)[]) this.usage[key] += Number(usage[key]) || 0;
    if (reason) this.finishReason = reason;
    if (reason === 'length') this.truncated = true;
    this.upstreamMs = Date.now() - this.upstreamStart;
  }
  upstreamError(status?: number) { syslog('error', 'ai.upstream_error', { requestId: this.requestId, route: this.route, upstreamStatus: status, errorClass: 'UpstreamError' }); }
  error(error: unknown) {
    if (!this.requested) { this.requested = true; syslog('info', 'ai.request', { requestId: this.requestId, route: this.route }); }
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    if (status === 429) { syslog('warn', 'ai.ratelimit', { route: this.route, limited: true }); return; }
    const event = status < 500 ? 'ai.invalid_input' : 'ai.error';
    // Arbitrary exception messages may contain submitted data. Only emit a fixed category.
    syslog('error', event, { requestId: this.requestId, route: this.route, status, limited: status === 429, errorClass: error instanceof Error ? (error.name === 'AiError' ? 'AiError' : 'Error') : 'UnknownError', errorMessage: 'AI request failed' });
  }
  response(response: Response) {
    const headers = new Headers(response.headers); headers.set('x-request-id', this.requestId);
    if (!response.body || response.status !== 200) return new Response(response.body, { status: response.status, headers });
    let outputChars = 0;
    const decoder = new TextDecoder(); let pending = '';
    const telemetry = this;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        // Count only visible SSE deltas, retaining at most one partial SSE line in memory.
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n'); pending = lines.pop() || '';
        for (const line of lines) if (line.startsWith('data: ')) { try { const data = JSON.parse(line.slice(6)); const content = data.delta?.text; if (typeof content === 'string') outputChars += content.length; if (data.error) telemetry.error(new Error('stream failed')); } catch {} }
        controller.enqueue(chunk);
      },
      flush() { syslog('info', 'ai.done', { requestId: telemetry.requestId, route: telemetry.route, status: 200, durationMs: Date.now() - telemetry.start, ttfbMs: telemetry.first ? telemetry.first - telemetry.start : null, upstreamMs: telemetry.upstreamMs, promptTokens: telemetry.usage.prompt_tokens, completionTokens: telemetry.usage.completion_tokens, totalTokens: telemetry.usage.total_tokens, cacheHitTokens: telemetry.usage.prompt_cache_hit_tokens, cacheMissTokens: telemetry.usage.prompt_cache_miss_tokens, outputChars, repaired: telemetry.repaired, truncated: telemetry.truncated, finishReason: telemetry.finishReason }); },
    });
    return new Response(response.body.pipeThrough(counter), { status: response.status, headers });
  }
}
