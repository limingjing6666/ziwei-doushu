import { createPlaceholderBuffer } from './postprocess';
import { encodeDelta, readSseData } from './sse';
import { repairAnswer, type Rewriter } from './repair';
import { logIssues, validateAnswer, type ValidationInput } from './validate';

export const BUFFER_HEARTBEAT_MS = 10000;
export const OUTPUT_CHUNK_CHARS = 96;
/** Same delta/error/length/DONE frames as before. Heartbeats are SSE comments, already
 * understood/ignored by readSseData; there is no status-event type in the client protocol. */
export function consistencyStream(upstream: Response, input: Omit<ValidationInput, 'text'>, options: { buffered: boolean; deadline: number; rewrite: Rewriter; signal?: AbortSignal }): Response {
  if (!upstream.body) return upstream;
  const stop = new AbortController(), signal = options.signal ? AbortSignal.any([stop.signal, options.signal]) : stop.signal;
  const encoder = new TextEncoder();
  const source = readSseData(upstream.body, signal);
  let full = '', cancelled = false, timer: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (wire: string) => { if (!cancelled && !signal.aborted) controller.enqueue(encoder.encode(wire)); };
      const delta = (text: string) => { if (text) send(encodeDelta(text)); };
      let unknown = 0;
      const buffer = createPlaceholderBuffer(input.facts, () => { unknown++; });
      if (options.buffered) timer = setInterval(() => send(': ping\n\n'), BUFFER_HEARTBEAT_MS);
      let terminal: string | undefined;
      try {
        for await (const frame of source) {
          if (frame === '[DONE]') {
            if (options.buffered) {
              const result = terminal ? buffer.push(full) + buffer.finish() : await repairAnswer({ ...input, text: full }, { deadline: options.deadline, rewrite: options.rewrite });
              for (let i = 0; i < result.length; i += OUTPUT_CHUNK_CHARS) delta(result.slice(i, i + OUTPUT_CHUNK_CHARS));
            } else {
              const tail = buffer.finish(); delta(tail); full += tail;
              logIssues(validateAnswer({ ...input, text: full }));
            }
            if (unknown) console.warn('[ai-consistency]', { 'placeholder-left': unknown });
            if (terminal && options.buffered) send(`data: ${terminal}\n\n`);
            send('data: [DONE]\n\n'); return;
          }
          const event = JSON.parse(frame);
          if (typeof event.delta?.text === 'string') {
            if (options.buffered) full += event.delta.text;
            else { const text = buffer.push(event.delta.text); full += text; delta(text); }
          }
          if (event.error || event.finish_reason) {
            terminal = JSON.stringify(event);
            if (!options.buffered) { const tail = buffer.finish(); full += tail; delta(tail); send(`data: ${terminal}\n\n`); }
          }
        }
        throw new Error('missing terminal frame');
      } catch {
        if (options.buffered && full) delta(buffer.push(full) + buffer.finish());
        send('data: {"error":"解读暂时中断，请稍后重试。"}\n\ndata: [DONE]\n\n');
      } finally {
        clearInterval(timer);
        if (!cancelled) controller.close();
        await source.return(undefined).catch(() => {});
      }
    },
    cancel() { cancelled = true; clearInterval(timer); stop.abort(); },
  });
  return new Response(body, { status: upstream.status, headers: upstream.headers });
}
