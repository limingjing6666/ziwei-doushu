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

export function loadTopics(chart: ZiweiChart): { topics: Partial<Record<TopicKey, Message[]>>; active?: TopicKey } {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(chart)) ?? '{}');
    const keys: TopicKey[] = ['overview', 'love', 'career', 'wealth', 'health', 'personality'];
    return { topics: Object.fromEntries(keys.filter(key => saved[key]).map(key => [key, saved[key]])), active: keys.includes(saved.active) ? saved.active : undefined };
  }
  catch { return { topics: {} }; }
}

export function saveTopics(chart: ZiweiChart, topics: Partial<Record<TopicKey, Message[]>>, active?: TopicKey) {
  try {
    const key = storageKey(chart);
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...saved, ...topics, ...(active ? { active } : {}), updated: Date.now() }));
    const keys = Object.keys(localStorage).filter(key => key.startsWith('tianjipan-ai-topics-v1:'));
    if (keys.length > 20) {
      const records = keys.map(key => {
        const updated = JSON.parse(localStorage.getItem(key)!).updated;
        return { key, updated: typeof updated === 'number' && Number.isFinite(updated) ? updated : 0 };
      }).sort((a, b) => a.updated - b.updated);
      for (const record of records.slice(0, records.length - 20)) localStorage.removeItem(record.key);
    }
  } catch {}
}
