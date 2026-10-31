/** SSE framing shared by upstream proxy and browser. Network chunks are NOT lines/events. */
export async function* readSseData(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader();
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const decoder = new TextDecoder();
  const maxFrame = 1024 * 1024;
  let line = '';
  let data: string[] = [];
  let frameSize = 0;
  let afterCR = false;
  const finishLine = () => {
    if (line === '') {
      const event = data.length ? data.join('\n') : undefined;
      data = [];
      frameSize = 0;
      return event;
    }
    if (line.startsWith('data:')) {
      const value = line.slice(5).replace(/^ /, '');
      frameSize += value.length + 1;
      if (frameSize > maxFrame) throw new Error('SSE frame too large');
      data.push(value);
    }
    return undefined;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new Error('SSE aborted');
      // Decode before framing: UTF-8 code points and CRLF may both straddle chunks.
      for (const char of decoder.decode(value, { stream: !done })) {
        if (char === '\n' && afterCR) { afterCR = false; continue; }
        afterCR = char === '\r';
        if (char === '\n' || char === '\r') {
          const event = finishLine();
          line = '';
          if (event !== undefined) yield event;
        } else {
          line += char;
          if (line.length + frameSize > maxFrame) throw new Error('SSE frame too large');
        }
      }
      if (done) {
        if (line) finishLine();
        if (data.length) yield data.join('\n');
        break;
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export const encodeDelta = (text: string) => `data: ${JSON.stringify({ delta: { text } })}\n\n`;
