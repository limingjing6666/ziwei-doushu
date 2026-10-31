'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import Markdown from '@/components/Markdown';
import { AiErrorNotice, AiLoading } from '@/components/AiStatus';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { validateBirthForm } from '@/lib/birth-form';
import { generateChart } from '@/lib/ziwei/algorithm';
import { requestAi, classifyAiError, type AiClientError } from '@/lib/ai/client';
import { buildAiView } from '@/components/TimeNav';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface Turn { question: string; answer: string }
export default function HemingPage() {
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);
  const [charts, setCharts] = useState<{ chartA: ZiweiChart; chartB: ZiweiChart } | null>(null);
  const [report, setReport] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AiClientError | null>(null);
  const [formError, setFormError] = useState('');
  const request = useRef<AbortController | null>(null);
  const forms = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLElement>(null);
  const last = useRef<{ payload: Record<string, unknown>; index: number } | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const execute = async (payload: Record<string, unknown>, index: number) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    last.current = { payload, index }; setLoading(true); setError(null);
    try {
      await requestAi('/api/heming', payload, text => {
        if (index === -1) setReport(text);
        else setTurns(prev => prev.map((t, i) => i === index ? { ...t, answer: text } : t));
      }, controller.signal);
    } catch (e) { if (!controller.signal.aborted) setError(classifyAiError(e)); }
    finally { if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setLoading(false); } }
  };
  const start = async () => {
    if (request.current || loading) return;
    setFormError('');
    const invalid = [formA, formB].findIndex(f => !f || Object.keys(validateBirthForm(f)).length > 0);
    if (invalid >= 0) {
      setFormError(`请检查${invalid === 0 ? '甲' : '乙'}方的出生信息`);
      forms.current?.querySelectorAll('form')[invalid]?.requestSubmit(); return;
    }
    setLoading(true); setError(null);
    await new Promise(resolve => setTimeout(resolve, 32));
    try {
      const pair = { chartA: generateChart(formToBirthInfo(formA!)), chartB: generateChart(formToBirthInfo(formB!)) };
      setCharts(pair); setReport(''); setTurns([]);
      const year = new Date().getFullYear();
      result.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await execute({ ...pair, viewA: buildAiView(pair.chartA, 'mingpan', year), viewB: buildAiView(pair.chartB, 'mingpan', year), mode: 'overview' }, -1);
    } catch { setFormError('排盘未完成，请检查双方出生信息后重试'); setLoading(false); }
  };
  const follow = (q: string) => {
    if (!q.trim() || loading || request.current || !charts) return;
    const index = turns.length;
    setTurns(prev => [...prev, { question: q, answer: '' }]); setQuestion('');
    const year = new Date().getFullYear();
    void execute({ ...charts, question: q, mode: 'followup', reportSummary: report.slice(0, 1600),
      messages: turns.slice(-6).flatMap(t => [{ role: 'user', content: t.question.slice(0, 2000) }, { role: 'assistant', content: t.answer.slice(0, 2000) }]),
      viewA: buildAiView(charts.chartA, 'mingpan', year), viewB: buildAiView(charts.chartB, 'mingpan', year) }, index);
  };
  return <main className="max-w-6xl mx-auto p-4 sm:p-6 py-8">
    <header className="flex flex-wrap justify-between gap-3 mb-8"><Link className="ux-button" href="/">← 首页</Link><Link className="ux-button" href="/chart">个人排盘</Link></header>
    <h1 className="text-2xl mb-3 text-center" style={{ color: 'var(--ac)' }}>紫微合盘</h1>
    <p className="text-sm text-center mb-6">对照双方的沟通方式、关系期待与分工，给出可尝试的相处建议。</p>
    <div ref={forms} className="heming-grid grid grid-cols-1 md:grid-cols-2 gap-5">
      <section className="min-w-0"><h2 className="text-lg mb-2">甲方 A</h2><BirthForm hideSubmit lateZishiRule="next-day" onSubmit={() => {}} onFormSave={setFormA} /></section>
      <section className="min-w-0"><h2 className="text-lg mb-2">乙方 B</h2><BirthForm hideSubmit lateZishiRule="next-day" onSubmit={() => {}} onFormSave={setFormB} /></section>
    </div>
    {formError && <p role="alert" className="field-error my-3">{formError}</p>}
    <button className="ux-primary my-6 w-full" disabled={loading} onClick={start}>{loading ? '正在分析…' : report ? '用当前表单重新合盘' : '开始合盘分析'}</button>
    <section ref={result} className="card rounded-2xl p-4 sm:p-7 scroll-mt-4" aria-label="原始合盘报告">
      <h2 className="text-lg mb-2" style={{ color: 'var(--ac)' }}>合盘报告</h2><Link href="/glossary" className="underline text-sm">看不懂术语？点这里查术语表</Link>
      {charts && [charts.chartA, charts.chartB].map((c, i) => <div key={i}>{c.birthInfo.birthTimeKnown === false && <div className="ux-notice my-3">{i === 0 ? '甲方' : '乙方'}出生时辰未知，命宫、身宫和各宫排布不可靠，结果仅供参考。<button className="underline ml-2" onClick={() => forms.current?.querySelectorAll('form')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>补充时辰重新排盘</button></div>}{c.birthInfo.timeCorrectionNotice && <p className="ux-notice my-3">{i === 0 ? '甲方' : '乙方'}：{c.birthInfo.timeCorrectionNotice}。可在上方表单改按钟表时间后重新合盘。</p>}</div>)}
      {!report && !loading && !error && <p className="text-sm my-6">填写双方信息后开始分析。报告会保留在这里，追问不会替换它。</p>}
      <Markdown text={report} streaming={loading && last.current?.index === -1} />
      {loading && last.current?.index === -1 && <AiLoading />}
      {last.current?.index === -1 && <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(last.current.payload, -1); }} />}
    </section>
    {report && <section className="mt-6" aria-label="合盘追问对话"><h2 className="text-lg mb-4">继续追问（原报告保持不变）</h2>
      <div className="space-y-4">{turns.map((turn, i) => <div key={i} className="card rounded-xl p-4"><p className="text-sm rounded-xl p-3 ml-5 mb-3" style={{ background: 'var(--ac-bg)' }}>{turn.question}</p><Markdown text={turn.answer} streaming={loading && last.current?.index === i} />{loading && last.current?.index === i && <AiLoading />}{last.current?.index === i && <AiErrorNotice error={error} loading={loading} retry={() => { if (last.current) void execute(last.current.payload, i); }} />}</div>)}</div>
      <div className="flex flex-wrap gap-2 my-4">{['我们怎样沟通更舒服？', '适合怎样分工合作？', '分歧时可以怎么处理？'].map(q => <button className="ux-button text-sm" disabled={loading} key={q} onClick={() => follow(q)}>{q}</button>)}</div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); follow(question); }}><input aria-label="合盘追问" className="input-base flex-1 min-w-0" maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} placeholder="如：怎样减少沟通中的误会？" disabled={loading} /><button className="ux-button shrink-0" disabled={loading || !question.trim()}>{loading ? '解读中…' : '追问'}</button></form>
    </section>}
  </main>;
}
