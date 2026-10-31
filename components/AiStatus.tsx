'use client';
import { useEffect, useState } from 'react';
import type { AiClientError } from '@/lib/ai/client';
export function AiLoading() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const timer = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(timer); }, []);
  return <p role="status" className="ux-notice animate-pulse">正在读取命盘… 已等待 {seconds} 秒</p>;
}
export function AiErrorNotice({ error, retry, loading }: { error: AiClientError | null; retry: () => void; loading: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { if (!error?.retryAt) return; const timer = setInterval(() => tick(s => s + 1), 1000); return () => clearInterval(timer); }, [error]);
  if (!error) return null;
  const remaining = Math.max(0, Math.ceil(((error.retryAt ?? 0) - Date.now()) / 1000));
  return <div role="alert" className="ux-notice my-3"><p>{error.kind === 'minute' ? remaining ? `请求有点频繁，请 ${remaining} 秒后再试` : '现在可以重试了' : error.message}</p><button className="ux-button mt-2" disabled={loading || remaining > 0} onClick={retry}>重试</button></div>;
}
