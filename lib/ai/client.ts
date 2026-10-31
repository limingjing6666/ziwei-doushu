import { readSseData } from './sse';

export type ErrorKind = 'network' | 'server' | 'minute' | 'daily' | 'interrupted' | 'length' | 'other';
export class AiClientError extends Error {
  constructor(message: string, public kind: ErrorKind = 'other', public retryAt?: number) { super(message); }
}
export function classifyAiError(error: unknown): AiClientError | null {
  if (error instanceof Error && error.name === 'AbortError') return null;
  if (error instanceof AiClientError) return error;
  if (error instanceof TypeError || (error instanceof Error && /fetch|network|offline|load failed/i.test(error.message))) return new AiClientError('网络好像不通，请检查网络后重试', 'network');
  return new AiClientError('解读服务暂时繁忙，请稍后重试', 'server');
}
const interrupted = () => new AiClientError('内容生成中断了，已保留已收到的部分，可点重试', 'interrupted');
export async function consumeAiResponse(response: Response, onText: (text: string) => void): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 429) {
      if (body?.limitKind === 'daily' || /今天|明天|每日/.test(body?.error ?? '')) throw new AiClientError('今天的免费解读次数已用完，明天再来', 'daily');
      const header = response.headers.get('Retry-After');
      const delay = header && !Number.isFinite(Number(header)) ? (Date.parse(header) - Date.now()) / 1000 : Number(header || body?.retryAfter);
      const seconds = Number.isFinite(delay) && delay > 0 ? Math.max(1, Math.ceil(delay)) : 60;
      throw new AiClientError(`请求有点频繁，请 ${seconds} 秒后再试`, 'minute', Date.now() + seconds * 1000);
    }
    if (response.status >= 500) throw new AiClientError('解读服务暂时繁忙，请稍后重试', 'server');
    throw new AiClientError(typeof body?.error === 'string' ? body.error : '请求未完成，请检查输入后重试');
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new AiClientError('未收到解读内容，请稍后重试');
  let text = '';
  try {
    for await (const data of readSseData(response.body)) {
      if (data === '[DONE]') { if (!text) throw new AiClientError('未收到解读内容，请稍后重试'); return; }
      let parsed;
      try { parsed = JSON.parse(data); } catch { throw interrupted(); }
      if (!parsed || typeof parsed !== 'object') throw interrupted();
      if (parsed.finish_reason === 'length') throw new AiClientError('内容较长已截断，可在输入框追问「继续」', 'length');
      if (typeof parsed.error === 'string') throw interrupted();
      if (typeof parsed.delta?.text === 'string') { text += parsed.delta.text; onText(text); }
    }
  } catch (e) {
    if (e instanceof AiClientError || (e instanceof Error && e.name === 'AbortError')) throw e;
    throw interrupted();
  }
  throw interrupted();
}

// Session-memory only: no birth data or conversation is written to browser storage.
const cache = new Map<string, string>();
export async function requestAi(endpoint: string, body: Record<string, unknown>, onText: (text: string) => void, signal: AbortSignal): Promise<void> {
  // Follow-ups depend on the complete conversation, not just the final question.
  // Explicit topics/details send a standalone message, so repeated topics still hit.
  const key = JSON.stringify({ endpoint, ...body });
  if (cache.has(key)) { onText(cache.get(key)!); return; }
  let result = '';
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    await consumeAiResponse(response, text => { result = text; onText(text); });
    cache.set(key, result);
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
  } catch (e) { if (signal.aborted) return; throw classifyAiError(e) ?? e; }
}
