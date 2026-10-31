import { readSseData } from './sse';

/** Shared browser decoder: preserves split UTF-8 and JSON frames, surfaces server Chinese errors. */
export async function consumeAiResponse(response: Response, onText: (text: string) => void): Promise<void> {
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.error === 'string' ? error.error : '解读暂时不可用，请稍后重试。');
  }
  if (!response.body) throw new Error('未收到解读内容，请稍后重试。');
  let text = '';
  for await (const data of readSseData(response.body)) {
    if (data === '[DONE]') return;
    const parsed = JSON.parse(data);
    if (typeof parsed.delta?.text === 'string') {
      text += parsed.delta.text;
      onText(text);
    }
  }
  throw new Error('解读连接中断，请稍后重试。');
}
