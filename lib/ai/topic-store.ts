import type { Message, TopicKey } from '@/components/InsightPanel';
import type { ZiweiChart } from '@/lib/ziwei/types';

function storageKey(chart: ZiweiChart) {
  const { year, month, day, hour, gender, birthTimeKnown } = chart.birthInfo;
  const identity = `${year}-${month}-${day}-${hour}-${gender}-${birthTimeKnown !== false}`;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < identity.length; i++) {
    const ch = identity.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'tianjipan-ai-topics-v1:' + (4294967296 * (h2 & 2097151) + (h1 >>> 0)).toString(36);
}

export function loadTopics(chart: ZiweiChart): Partial<Record<TopicKey, Message[]>> {
  try { return JSON.parse(localStorage.getItem(storageKey(chart)) ?? '{}'); }
  catch { return {}; }
}

export function saveTopics(chart: ZiweiChart, topics: Partial<Record<TopicKey, Message[]>>) {
  try {
    const key = storageKey(chart);
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...saved, ...topics }));
  } catch {}
}
