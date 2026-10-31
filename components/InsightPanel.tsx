'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import type { AiView, ChatMessage } from '@/lib/ai/input';
import type { TimeView } from './TimeNav';
import { requestAi, classifyAiError, type AiClientError } from '@/lib/ai/client';
import { termDescription } from '@/lib/glossary';
import Markdown from './Markdown';
import Term from './Term';
import { AiErrorNotice, AiLoading } from './AiStatus';

interface Props {
  chart: ZiweiChart; selectedPalace?: Palace | null; selectedStar?: Star | null;
  selectedSiHua?: { starName: string; siHua: string; view: TimeView } | null;
  view?: AiView;
}
const TOPICS = [
  ['overview', '整盘', '请用大白话先总结核心倾向，再给简明依据与三条建议。'],
  ['love', '感情', '请分析关系期待、沟通方式与相处建议，不断言婚期或结局。'],
  ['career', '事业', '请分析工作方式与当前所选年份的事业主题，先给结论，再说明依据与建议。'],
  ['wealth', '财运', '请分析收入方式、预算与资源安排，不推荐投资标的或交易时机。'],
  ['rhythm', '身心状态', '只谈作息、压力、情绪与生活节奏，不涉及疾病、器官、医疗建议或健康关键年份。'],
  ['personality', '性格', '请说明性格观察线索和可尝试的小行动，不给人贴好坏标签。'],
];
export default function InsightPanel({ chart, selectedPalace, selectedStar, selectedSiHua, view }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiClientError | null>(null);
  const request = useRef<AbortController | null>(null);
  const last = useRef<{ payload: Record<string, unknown>; index: number } | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const execute = async (payload: Record<string, unknown>, index: number) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    last.current = { payload, index }; setLoading(true); setError(null);
    try {
      await requestAi('/api/interpret', payload, text => setMessages(prev => prev.map((m, i) => i === index ? { role: 'assistant', content: text } : m)), controller.signal);
    } catch (e) { if (!controller.signal.aborted) setError(classifyAiError(e)); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setLoading(false); } }
  };
  const send = (question: string, mode: 'overview' | 'detail' | 'followup' = 'followup', standalone = false) => {
    if (!question.trim() || request.current) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages([...next, { role: 'assistant', content: '' }]); setInput('');
    void execute({ chart, messages: (standalone ? next.slice(-1) : next.slice(-12)).map(m => ({ ...m, content: m.content.slice(0, 2000) })), view: view ?? { type: 'yearly', year: new Date().getFullYear() }, birthTimeKnown: chart.birthInfo.birthTimeKnown !== false, mode }, next.length);
  };
  const localQuestion = selectedStar ? `请简要解读${selectedPalace?.name ?? ''}的${selectedStar.name}，先说白话结论。`
    : selectedSiHua ? `请简要解读当前所选视图的${selectedSiHua.starName}化${selectedSiHua.siHua}。`
    : selectedPalace ? `请简要解读${selectedPalace.name}，先说白话结论。` : '';
  return <section className="ai-panel card-glass rounded-xl p-4 min-w-0" aria-label="AI 解读">
    <h2 className="text-lg mb-2" style={{ color: 'var(--ac)' }}>AI 解读</h2>
    <p className="text-sm mb-3"><Link href="/glossary" className="underline">看不懂术语？点这里查术语表</Link></p>
    {(selectedPalace || selectedSiHua) && <div className="ux-notice mb-4" aria-label="本地静态信息">
      <p className="text-xs mb-2">本地简介 · 不消耗 AI 次数</p>
      {selectedPalace && <><h3><Term name={selectedPalace.name} /></h3><p className="my-2">{termDescription(selectedPalace.name)}</p><p>主星：{selectedPalace.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫，可参考对宫主星'}</p></>}
      {selectedStar && <p className="my-2"><Term name={selectedStar.name} />：{termDescription(selectedStar.name)}</p>}
      {selectedSiHua && <p><Term name={`化${selectedSiHua.siHua}`} />：{termDescription(`化${selectedSiHua.siHua}`)}</p>}
      <button className="ux-button mt-3" disabled={loading} onClick={() => send(localQuestion, 'detail', true)}>{loading ? '解读中…' : selectedStar ? '让 AI 解读这颗星' : selectedSiHua ? '让 AI 解读这一四化' : '让 AI 解读这一宫'}</button>
    </div>}
    <p className="text-xs mb-2" style={{ color: 'var(--tx-2)' }}>以下话题会请求 AI；点盘面只看简介。</p>
    <div className="grid grid-cols-3 gap-2 mb-5">{TOPICS.map(([key, label, question]) => <button key={key} className="ux-button text-sm px-1" disabled={loading} onClick={() => send(question, key === 'overview' ? 'overview' : 'followup', true)}>{label}</button>)}</div>
    {messages.length === 0 && <p className="text-sm my-6" style={{ color: 'var(--tx-2)' }}>命盘已生成。先看看宫位简介，再选一个想了解的话题。</p>}
    <div className="space-y-4" aria-live="polite">{messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'rounded-xl p-3 ml-6 text-sm' : 'py-2'} style={m.role === 'user' ? { background: 'var(--ac-bg)', border: '1px solid var(--ac-bdr)' } : undefined}>{m.role === 'assistant' ? <Markdown text={m.content} streaming={loading && i === messages.length - 1} /> : m.content}</div>)}</div>
    {loading && <AiLoading />}
    <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(last.current.payload, last.current.index); }} />
    <form className="flex gap-2 mt-4" onSubmit={e => { e.preventDefault(); send(input); }}><input aria-label="向 AI 提问" className="input-base min-w-0 flex-1" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="今年适合换工作吗？" disabled={loading} /><button className="ux-button shrink-0" disabled={loading || !input.trim()}>{loading ? '解读中…' : '提问'}</button></form>
  </section>;
}
