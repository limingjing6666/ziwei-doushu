import { createHash } from 'node:crypto';
import { AiError } from './input';

export function checkOrigin(request: Request): void {
  if (process.env.NODE_ENV !== 'production') return;
  for (const header of ['origin', 'referer']) {
    const value = request.headers.get(header);
    if (!value) continue; // CLI/server clients may omit both; this is not authentication.
    let url: URL;
    try { url = new URL(value); } catch { throw new AiError(403, '请求来源不受允许。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new AiError(403, '请求来源不受允许。');
    const overrides = process.env.AI_ALLOWED_ORIGINS;
    const allowed = overrides !== undefined
      ? overrides.split(',').map(s => s.trim()).filter(Boolean).some(s => {
          if (s.startsWith('*.')) return url.hostname.endsWith(s.slice(1)) && url.hostname !== s.slice(2);
          try { return new URL(s).origin === url.origin; } catch { return url.hostname === s; }
        })
      : ['tianjipan.tech', 'www.tianjipan.tech', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.vercel.app');
    if (!allowed) throw new AiError(403, '请求来源不受允许，请从本站发起解读。');
  }
}

// Serverless instances do not share memory: this fallback is best effort only.
const counters = new Map<string, { count: number; expires: number }>();
const configured = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

export async function checkRateLimit(request: Request): Promise<void> {
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 200);
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const now = Date.now();
  const windows = [
    { key: `ai:${hash}:m:${Math.floor(now / 60000)}`, ttl: 120, limit: configured('AI_MINUTE_LIMIT', 5), message: '请求太频繁，请一分钟后再试。' },
    { key: `ai:${hash}:d:${Math.floor(now / 86400000)}`, ttl: 172800, limit: configured('AI_DAILY_LIMIT', 30), message: '今天的 AI 解读次数已用完，请明天再来。' },
  ];
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  let values: number[];
  if (url && token) {
    try {
      // TTL is refreshed but keys contain the fixed window, so quota never rolls forward.
      const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(windows.flatMap(w => [['INCR', w.key], ['EXPIRE', w.key, w.ttl]])),
        signal: AbortSignal.timeout(5000), cache: 'no-store',
      });
      if (!response.ok) throw new Error();
      const results = await response.json() as { result?: number; error?: string }[];
      if (!Array.isArray(results) || results.length !== 4 || results.some(r => r.error || typeof r.result !== 'number')) throw new Error();
      values = [results[0].result!, results[2].result!];
    } catch { throw new AiError(503, '解读服务暂时繁忙，请稍后重试。'); }
  } else {
    for (const [key, value] of counters) if (value.expires <= now) counters.delete(key);
    if (counters.size > 20000) throw new AiError(503, '解读服务暂时繁忙，请稍后重试。');
    values = windows.map(w => {
      const old = counters.get(w.key);
      const next = { count: (old?.count ?? 0) + 1, expires: old?.expires ?? now + w.ttl * 1000 };
      counters.set(w.key, next);
      return next.count;
    });
  }
  windows.forEach((w, i) => { if (values[i] > w.limit) throw new AiError(429, w.message); });
}
