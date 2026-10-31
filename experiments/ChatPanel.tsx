'use client';
import type { ZiweiChart } from '@/lib/ziwei/types';
import type { AiView } from '@/lib/ai/input';
import InsightPanel from '@/components/InsightPanel';
/** All AI displays share the same safe renderer, retries and explicit-request behavior. */
export default function ChatPanel({ chart, view }: { chart: ZiweiChart; view?: AiView }) {
  return <InsightPanel chart={chart} view={view} />;
}
