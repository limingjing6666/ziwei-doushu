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
interface Message extends ChatMessage { hidden?: boolean }
const TOPICS = [
  ['overview', '整盘', '【整盘】首句直答整体特点。之后分节：性格底色、主要优势、近期重心、三条建议。'],
  ['love', '感情', '【感情】首句直答关系特点。之后分节：关系期待、双方相处、容易遇到对象、结婚或感情变动的大限/流年依据、三条建议。'],
  ['career', '事业', '【事业】首句直答工作特点。之后分节：工作方式、事业依据、所选年份重心、三条建议。'],
  ['wealth', '财运', '【财运】首句直答收入特点。之后分节：收入方式、资源安排、盘面依据、三条建议。'],
  ['health', '健康', '【健康】首句直答体质特点。之后分节：身体倾向、疾厄与福德及命宫依据、事实区块中的健康年份、三条建议。时辰未知时仅讲允许的大方向。'],
  ['personality', '性格', '【性格】首句直答性格特点。之后分节：行为方式、人际互动、优势与课题、三条建议。'],
] as const;

/** 盘面点击只更新简介；仅显式点击话题/解读/追问才发请求，不自动滚动。 */
export default function InsightPanel({ chart, selectedPalace, selectedStar, selectedSiHua, view, className }: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
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
  const send = (question: string, mode: 'overview' | 'detail' | 'followup' = 'followup', standalone = false, hidden = false) => {
    if (!question.trim() || request.current) return;
    const next: Message[] = [...messages, { role: 'user', content: question, hidden }];
    setMessages([...next, { role: 'assistant', content: '' }]); setInput('');
    void execute({ chart, messages: (standalone ? next.slice(-1) : next.filter(m => m.content).slice(-12)).map(m => ({ role: m.role, content: m.content.slice(0, 2000) })), view: view ?? { type: 'natal', year: new Date().getFullYear() }, birthTimeKnown: chart.birthInfo.birthTimeKnown !== false, mode }, next.length);
  };
  const localQuestion = selectedStar ? `请解读${selectedPalace?.name ?? ''}的${selectedStar.name}，第一句给白话结论，再充分说明依据与建议。`
    : selectedSiHua ? `请解读当前所选视图的${selectedSiHua.starName}化${selectedSiHua.siHua}，第一句给白话结论，再充分说明依据与建议。`
    : selectedPalace ? `请解读${selectedPalace.name}，第一句给白话结论，再充分说明依据与建议。` : '';
  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="shrink-0 border-b border-line/12 px-3 pb-2.5 pt-3 sm:px-4">
        <h2 className="font-serif text-[16px] font-semibold tracking-[0.02em] text-ink">AI 解读</h2>
        <Link href="/glossary" className="text-xs text-cinnabar underline">看不懂术语？查术语表</Link>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-line/12 px-3 py-2 sm:px-4">
        {TOPICS.map(([key, label, question]) => <button key={key} type="button" disabled={loading} aria-pressed={activeTopic === key} onClick={() => { setActiveTopic(key); send(question, 'overview', true, true); }} className={cn('inline-flex h-9 items-center rounded-sm border px-2.5 text-[12px] transition-colors disabled:opacity-45', activeTopic === key ? 'border-cinnabar/35 bg-cinnabar/8 font-medium text-cinnabar' : 'border-line/20 text-ink-2 hover:bg-surface-2')}>{label}</button>)}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-4">
        {(selectedPalace || selectedSiHua) && <div className="rounded-sm border border-line/20 bg-surface-2 p-3 text-sm text-ink-2" aria-label="简介">
          {selectedPalace && <><h3><Term name={selectedPalace.name} /></h3><p className="my-2">{termDescription(selectedPalace.name)}</p><p>主星：{selectedPalace.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫，可参考对宫主星'}</p></>}
          {selectedStar && <p className="my-2"><Term name={selectedStar.name} />：{termDescription(selectedStar.name)}</p>}
          {selectedSiHua && <p><Term name={`化${selectedSiHua.siHua}`} />：{termDescription(`化${selectedSiHua.siHua}`)}</p>}
          <Button variant="secondary" className="mt-3" disabled={loading} onClick={() => send(localQuestion, 'detail', true, true)}>让 AI 解读{selectedStar ? '这颗星' : selectedSiHua ? '这一四化' : '这一宫'}</Button>
        </div>}
        {!messages.length && <p className="py-6 text-[13px] text-ink-3">命盘已生成。先看看宫位简介，再选一个想了解的话题；以下话题会请求 AI。</p>}
        <div className="space-y-4" aria-live="polite">{messages.map((m, i) => m.role === 'user' && m.hidden ? null : m.role === 'user' ? <div key={i} className="flex justify-end"><p className="max-w-[85%] break-words rounded-sm border border-line/20 bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{m.content}</p></div> : <div key={i}><p className="mb-1.5 text-xs text-ink-3">命理解读</p><AiProse text={m.content} streaming={loading && i === messages.length - 1} /></div>)}</div>
        {loading && <AiLoading />}
        <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(last.current.payload, last.current.index); }} />
      </div>
      <form className="shrink-0 border-t border-line/12 px-3 py-2.5 sm:px-4" onSubmit={e => { e.preventDefault(); send(input); }}>
        <div className="flex items-center gap-2"><Input aria-label="向 AI 提问" className="min-w-0" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="继续追问，如：今年适合换工作吗？" disabled={loading} /><Button type="submit" variant="secondary" disabled={loading || !input.trim()} className="shrink-0">{loading ? '生成中' : '追问'}</Button></div>
      </form>
    </Card>
  );
}
