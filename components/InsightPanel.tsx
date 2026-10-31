"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Palace, Star, ZiweiChart } from "@/lib/ziwei/types";
import type { AiView, ChatMessage } from "@/lib/ai/input";
import type { TimeView } from "./TimeNav";
import { requestAi, classifyAiError, type AiClientError } from "@/lib/ai/client";
import { termDescription } from "@/lib/glossary";
import { AiProse } from "@/components/ui/AiProse";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { AiErrorNotice, AiLoading } from "./AiStatus";
import Term from "./Term";
import { cn } from "@/lib/ui/cn";

export interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedStar?: Star | null;
  selectedSiHua?: { starName: string; siHua: string; view: TimeView } | null;
  view?: AiView;
  className?: string;
}
const TOPICS = [
  ['overview', '整盘', '请第一句用大白话总结核心倾向，再给充实的具体依据与三条可执行建议。'],
  ['love', '感情', '请详细分析感情婚姻、关系期待与相处建议，并给出容易遇到对象、结婚或感情变动的大限/流年及具体依据。'],
  ['career', '事业', '请分析工作方式与当前所选年份的事业主题，先给结论，再说明依据与建议。'],
  ['wealth', '财运', '请分析收入方式、预算与资源安排，不推荐投资标的或交易时机。'],
  ['health', '健康', '请结合疾厄宫、福德宫、命宫及所选大限流年，按传统断法详细讲我的体质倾向、易患疾病类别、需要留意的身体系统和年份，并说明依据。'],
  ['personality', '性格', '请说明性格观察线索和可尝试的小行动，不给人贴好坏标签。'],
] as const;

/** 盘面点击只更新本地简介；仅显式点击话题/解读/追问才发请求，不自动滚动。 */
export default function InsightPanel({ chart, selectedPalace, selectedStar, selectedSiHua, view, className }: InsightPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiClientError | null>(null);
  const [activeTopic, setActiveTopic] = useState('');
  const request = useRef<AbortController | null>(null);
  const last = useRef<{ payload: Record<string, unknown>; index: number } | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const execute = async (payload: Record<string, unknown>, index: number) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    last.current = { payload, index };
    setLoading(true); setError(null);
    try {
      await requestAi('/api/interpret', payload, text => setMessages(prev => prev.map((m, i) => i === index ? { role: 'assistant', content: text } : m)), controller.signal);
    } catch (e) { if (!controller.signal.aborted) setError(classifyAiError(e)); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setLoading(false); } }
  };
  const send = (question: string, mode: 'overview' | 'detail' | 'followup' = 'followup', standalone = false) => {
    if (!question.trim() || request.current) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages([...next, { role: 'assistant', content: '' }]); setInput('');
    void execute({ chart, messages: (standalone ? next.slice(-1) : next.filter(m => m.content).slice(-12)).map(m => ({ ...m, content: m.content.slice(0, 2000) })), view: view ?? { type: 'natal', year: new Date().getFullYear() }, birthTimeKnown: chart.birthInfo.birthTimeKnown !== false, mode }, next.length);
  };
  const localQuestion = selectedStar ? `请解读${selectedPalace?.name ?? ''}的${selectedStar.name}，第一句给白话结论，再充分说明依据与建议。`
    : selectedSiHua ? `请解读当前所选视图的${selectedSiHua.starName}化${selectedSiHua.siHua}，第一句给白话结论，再充分说明依据与建议。`
    : selectedPalace ? `请解读${selectedPalace.name}，第一句给白话结论，再充分说明依据与建议。` : '';
  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="shrink-0 border-b border-line/12 px-3 pb-2.5 pt-3 sm:px-4">
        <h2 className="font-serif text-[16px] font-semibold tracking-[0.02em] text-ink">AI 解读</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-3">内容由 AI 生成，仅供参考，不构成医疗、投资或法律建议。</p>
        <Link href="/glossary" className="text-xs text-cinnabar underline">看不懂术语？查术语表</Link>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line/12 px-3 py-2 sm:px-4">
        {TOPICS.map(([key, label, question]) => <button key={key} type="button" disabled={loading} aria-pressed={activeTopic === key} onClick={() => { setActiveTopic(key); send(question, ['overview', 'love', 'career', 'health'].includes(key) ? 'overview' : 'followup', true); }} className={cn('inline-flex h-9 items-center rounded-sm border px-2.5 text-[12px] transition-colors disabled:opacity-45', activeTopic === key ? 'border-cinnabar/35 bg-cinnabar/8 font-medium text-cinnabar' : 'border-line/20 text-ink-2 hover:bg-surface-2')}>{label}</button>)}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-4">
        {(selectedPalace || selectedSiHua) && <div className="rounded-sm border border-line/20 bg-surface-2 p-3 text-sm text-ink-2" aria-label="本地静态信息">
          <p className="mb-2 text-xs text-ink-3">本地简介 · 不消耗 AI 次数</p>
          {selectedPalace && <><h3><Term name={selectedPalace.name} /></h3><p className="my-2">{termDescription(selectedPalace.name)}</p><p>主星：{selectedPalace.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫，可参考对宫主星'}</p></>}
          {selectedStar && <p className="my-2"><Term name={selectedStar.name} />：{termDescription(selectedStar.name)}</p>}
          {selectedSiHua && <p><Term name={`化${selectedSiHua.siHua}`} />：{termDescription(`化${selectedSiHua.siHua}`)}</p>}
          <Button variant="secondary" className="mt-3" disabled={loading} onClick={() => send(localQuestion, 'detail', true)}>让 AI 解读{selectedStar ? '这颗星' : selectedSiHua ? '这一四化' : '这一宫'}</Button>
        </div>}
        {!messages.length && <p className="py-6 text-[13px] text-ink-3">命盘已生成。先看看宫位简介，再选一个想了解的话题；以下话题会请求 AI。</p>}
        <div className="space-y-4" aria-live="polite">{messages.map((m, i) => m.role === 'user' ? <div key={i} className="flex justify-end"><p className="max-w-[85%] break-words rounded-sm border border-line/20 bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{m.content}</p></div> : <div key={i}><p className="mb-1.5 text-xs text-ink-3">命理解读</p><AiProse text={m.content} streaming={loading && i === messages.length - 1} /></div>)}</div>
        {loading && <AiLoading />}
        <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(last.current.payload, last.current.index); }} />
      </div>
      <form className="shrink-0 border-t border-line/12 px-3 py-2.5 sm:px-4" onSubmit={e => { e.preventDefault(); send(input); }}>
        <div className="flex items-center gap-2"><Input aria-label="向 AI 提问" className="min-w-0" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="继续追问，如：今年适合换工作吗？" disabled={loading} /><Button type="submit" variant="secondary" disabled={loading || !input.trim()} className="shrink-0">{loading ? '生成中' : '追问'}</Button></div>
      </form>
    </Card>
  );
}
