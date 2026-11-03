"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Palace, Star, ZiweiChart } from "@/lib/ziwei/types";
import type { AiView, ChatMessage } from "@/lib/ai/input";
import type { TimeView } from "./TimeNav";
import { requestAi, classifyAiError, type AiClientError } from "@/lib/ai/client";
import { scheduleAutoOverview } from "@/lib/ai/auto-overview";
import { loadTopics, saveTopics } from "@/lib/ai/topic-store";
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
export interface Message extends ChatMessage {
  hidden?: boolean;
  interpretation?: { view: AiView; question: string; mode: 'overview' | 'detail' | 'followup'; standalone: boolean; hidden: boolean };
}
function viewLabel(view: AiView) {
  return `${{ natal: '本命', decadal: '大限', yearly: '流年' }[view.type]} · ${view.year} 年${view.decadal ? ` · ${view.decadal.startAge}–${view.decadal.endAge} 岁大限` : ''}`;
}
const TOPICS = [
  ['overview', '整盘', '【整盘】首句直答这张盘整体特点。之后分节：命宫与身宫定下的性格底色、三方四正里的主要优势与短板、所选大限或流年的近期重心、三条建议。每节都点明星曜、宫位和四化来源。'],
  ['love', '感情', '【感情】首句直答关系特点。之后分节：关系期待（看夫妻宫及对宫）、双方相处（看福德宫与命宫）、容易遇到对象、结婚或感情变动的大限/流年依据、三条建议。每节讲清星曜、宫位与四化来源。'],
  ['career', '事业', '【事业】首句直答工作特点。之后分节：工作方式（看命宫与官禄宫）、事业依据（官禄宫、迁移宫、财帛宫的星曜与四化）、所选年份的事业重心、三条建议。'],
  ['wealth', '财运', '【财运】首句直答收入特点。之后分节：收入方式（看财帛宫）、资源与积累安排（看田宅宫与福德宫）、盘面依据与所选年份的财务重心、三条建议。'],
  ['health', '健康', '【健康】首句直答体质特点。之后分节：身体倾向（只讲有数据支持的器官系统类别）、疾厄与福德及命宫依据、下面给出的健康年份、三条建议。时辰未知时仅讲允许的大方向。'],
  ['personality', '性格', '【性格】首句直答性格特点。之后分节：行为方式（看命宫与身宫）、人际互动（看迁移宫与仆役宫）、优势与课题（看福德宫与四化）、三条建议。'],
] as const;
export type TopicKey = typeof TOPICS[number][0];
const EMPTY_TOPICS: Record<TopicKey, Message[]> = { overview: [], love: [], career: [], wealth: [], health: [], personality: [] };

/** 每张盘自动请求一次整盘；盘面点击仍只更新简介，不自动滚动。 */
export default function InsightPanel({ chart, selectedPalace, selectedStar, selectedSiHua, view, className }: InsightPanelProps) {
  const [topics, setTopics] = useState<Record<TopicKey, Message[]>>(EMPTY_TOPICS);
  const [input, setInput] = useState('');
  const [topicLoading, setTopicLoading] = useState<Partial<Record<TopicKey, boolean>>>({});
  const [topicErrors, setTopicErrors] = useState<Partial<Record<TopicKey, AiClientError | null>>>({});
  const [activeTopic, setActiveTopic] = useState<TopicKey>('overview');
  const messages = topics[activeTopic];
  const loading = topicLoading[activeTopic] ?? false;
  const error = topicErrors[activeTopic] ?? null;
  const currentView = view ?? { type: 'natal', year: new Date().getFullYear() };
  const overviewSent = useRef(new WeakSet<object>());
  const request = useRef(new Map<TopicKey, AbortController>());
  const lastByTopic = useRef(new Map<TopicKey, { payload: Record<string, unknown>; index: number; fresh: boolean }>());
  const last = { current: lastByTopic.current.get(activeTopic) };
  useEffect(() => () => { for (const controller of request.current.values()) controller.abort(); }, []);
  const execute = async (topic: TopicKey, payload: Record<string, unknown>, index: number, fresh = false) => {
    if (request.current.has(topic)) return;
    const controller = new AbortController();
    request.current.set(topic, controller);
    lastByTopic.current.set(topic, { payload, index, fresh });
    setTopicLoading(prev => ({ ...prev, [topic]: true })); setTopicErrors(prev => ({ ...prev, [topic]: null }));
    try {
      await requestAi('/api/interpret', payload, text => setTopics(prev => ({ ...prev, [topic]: prev[topic].map((m, i) => i === index ? { ...m, content: text } : m) })), controller.signal, fresh);
    } catch (e) { if (!controller.signal.aborted) setTopicErrors(prev => ({ ...prev, [topic]: classifyAiError(e) })); }
    finally { if (request.current.get(topic) === controller) { request.current.delete(topic); if (!controller.signal.aborted) setTopicLoading(prev => ({ ...prev, [topic]: false })); } }
  };
  const sendTo = (topic: TopicKey, messages = topics[topic]) => (question: string, mode: 'overview' | 'detail' | 'followup' = 'followup', standalone = false, hidden = false, fresh = false) => {
    if (!question.trim() || request.current.has(topic)) return;
    const next: Message[] = [...messages, { role: 'user', content: question, hidden }];
    setTopics(prev => ({ ...prev, [topic]: [...next, { role: 'assistant', content: '', interpretation: { view: currentView, question, mode, standalone, hidden } }] })); setInput('');
    void execute(topic, { chart, messages: (standalone ? next.slice(-1) : next.filter(m => m.content).slice(-12)).map(m => ({ role: m.role, content: m.content.slice(0, 2000) })), view: currentView, birthTimeKnown: chart.birthInfo.birthTimeKnown !== false, mode }, next.length, fresh);
  };
  const send = sendTo(activeTopic);
  useEffect(() => scheduleAutoOverview(overviewSent.current, chart, () => {
    const saved = loadTopics(chart);
    setActiveTopic(saved.active ?? 'overview');
    setTopics({ ...EMPTY_TOPICS, ...saved.topics });
    const send = sendTo('overview', []);
    if (!saved.topics.overview?.length) send(TOPICS[0][2], 'overview', true, true);
    // Only a new chart triggers this effect; selection/view changes remain manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [chart]);
  useEffect(() => {
    const settled = TOPICS.filter(([key]) => topics[key].length && !request.current.has(key) && !topicLoading[key] && !topicErrors[key] && topics[key].every(m => m.role !== 'assistant' || m.content)).map(([key]) => [key, topics[key]]);
    saveTopics(chart, Object.fromEntries(settled));
  }, [chart, topics, topicLoading, topicErrors]);
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
        {TOPICS.map(([key, label, question]) => {
          const send = sendTo(key);
          return <button key={key} type="button" disabled={topicLoading[key]} aria-pressed={activeTopic === key} onClick={() => { setActiveTopic(key); saveTopics(chart, {}, key); if (!topics[key].length && !request.current.has(key)) send(question, 'overview', true, true); }} className={cn('inline-flex h-9 items-center rounded-sm border px-2.5 text-[12px] transition-colors disabled:opacity-45', activeTopic === key ? 'border-cinnabar/35 bg-cinnabar/8 font-medium text-cinnabar' : 'border-line/20 text-ink-2 hover:bg-surface-2')}>{label}</button>;
        })}
        <Button variant="secondary" size="sm" className="ml-auto" disabled={loading} onClick={() => { if (window.confirm('重新解读会替换这个板块现在的内容和追问，确定吗？')) sendTo(activeTopic, [])(TOPICS.find(([key]) => key === activeTopic)![2], 'overview', true, true, true); }}>重新解读</Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3 sm:px-4">
        {(selectedPalace || selectedSiHua) && <div className="rounded-sm border border-line/20 bg-surface-2 p-3 text-sm text-ink-2" aria-label="简介">
          {selectedPalace && <><h3><Term name={selectedPalace.name} /></h3><p className="my-2">{termDescription(selectedPalace.name)}</p><p>主星：{selectedPalace.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫，可参考对宫主星'}</p></>}
          {selectedStar && <p className="my-2"><Term name={selectedStar.name} />：{termDescription(selectedStar.name)}</p>}
          {selectedSiHua && <p><Term name={`化${selectedSiHua.siHua}`} />：{termDescription(`化${selectedSiHua.siHua}`)}</p>}
          <Button variant="secondary" className="mt-3" disabled={loading || !!topicLoading.overview} onClick={() => { setActiveTopic('overview'); saveTopics(chart, {}, 'overview'); const send = sendTo('overview'); send(localQuestion, 'detail', true, true); }}>让 AI 解读{selectedStar ? '这颗星' : selectedSiHua ? '这一四化' : '这一宫'}</Button>
        </div>}
        {!messages.length && <p className="py-6 text-[13px] text-ink-3">命盘已生成。先看看宫位简介，再选一个想了解的话题。</p>}
        <div className="space-y-4" aria-live="polite">{messages.map((m, i) => {
          const interpretation = m.interpretation;
          return m.role === 'user' && m.hidden ? null : m.role === 'user' ? <div key={i} className="flex justify-end"><p className="max-w-[85%] break-words rounded-sm border border-line/20 bg-surface-2 px-3 py-2 text-[13px] text-ink-2">{m.content}</p></div> : <div key={i}><p className="mb-1.5 text-xs text-ink-3">命理解读</p><AiProse text={m.content} streaming={loading && i === messages.length - 1} />
            {m.content && interpretation && JSON.stringify(interpretation.view) !== JSON.stringify(currentView) && <div className="mt-3 space-y-2 text-xs text-ink-3"><p>以上解读针对 {viewLabel(interpretation.view)}</p><Button variant="secondary" size="sm" disabled={loading} onClick={() => send(interpretation.question, interpretation.mode, interpretation.standalone, interpretation.hidden)}>按当前运限重新解读</Button></div>}
          </div>;
        })}</div>
        {loading && !messages[last.current?.index ?? -1]?.content && <AiLoading />}
        <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(activeTopic, last.current.payload, last.current.index, last.current.fresh); }} />
      </div>
      <form className="shrink-0 border-t border-line/12 px-3 py-2.5 sm:px-4" onSubmit={e => { e.preventDefault(); send(input); }}>
        <div className="flex items-center gap-2"><Input aria-label="向 AI 提问" className="min-w-0" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="继续追问，如：今年适合换工作吗？" disabled={loading} /><Button type="submit" variant="secondary" disabled={loading || !input.trim()} className="shrink-0">{loading ? '生成中' : '追问'}</Button></div>
      </form>
    </Card>
  );
}
