import { createSentenceWindow } from './disclaimer';
import { encodeDelta, readSseData } from './sse';
import { codeRepair, repairAnswer, type Rewriter } from './repair';
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
      const buffer = createSentenceWindow(text => codeRepair({ ...input, text }));
      if (options.buffered) timer = setInterval(() => send(': ping\n\n'), BUFFER_HEARTBEAT_MS);
      let terminal: string | undefined;
      try {
        for await (const frame of source) {
          if (frame === '[DONE]') {
            signal.throwIfAborted();
            if (options.buffered) {
              const result = terminal ? codeRepair({ ...input, text: full }) : await repairAnswer({ ...input, text: full }, { deadline: options.deadline, rewrite: options.rewrite, signal });
              for (let i = 0; i < result.length; i += OUTPUT_CHUNK_CHARS) delta(result.slice(i, i + OUTPUT_CHUNK_CHARS));
            } else {
              delta(buffer.finish());
              logIssues(validateAnswer({ ...input, text: codeRepair({ ...input, text: full }) }));
            }
            if (terminal && options.buffered) send(`data: ${terminal}\n\n`);
            send('data: [DONE]\n\n'); return;
          }
          const event = JSON.parse(frame);
          if (typeof event.delta?.text === 'string') {
            full += event.delta.text;
            if (!options.buffered) delta(buffer.push(event.delta.text));
          }
          if (event.error || event.finish_reason) {
            terminal = JSON.stringify(event);
            if (!options.buffered) { delta(buffer.finish()); send(`data: ${terminal}\n\n`); }
          }
        }
        throw new Error('missing terminal frame');
      } catch {
        if (!signal.aborted) {
          if (full) {
            if (options.buffered) delta(codeRepair({ ...input, text: full }));
            else delta(buffer.finish());
          }
          send(`data: ${options.buffered && terminal ? terminal : '{"error":"解读暂时中断，请稍后重试。"}'}\n\ndata: [DONE]\n\n`);
        }
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
