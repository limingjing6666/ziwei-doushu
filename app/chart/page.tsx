'use client';
import { useState } from 'react';
import Link from 'next/link';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSummary from '@/components/ChartSummary';
import InsightPanel from '@/components/InsightPanel';
import StarDetailPanel from '@/components/StarDetailPanel';
import ResultGuide from '@/components/ResultGuide';
import { termDescription } from '@/lib/glossary';
import { buildAiView, type TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';

export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [form, setForm] = useState<BirthFormState | undefined>();
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [mobileInfoClosed, setMobileInfoClosed] = useState(false);
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string; view: TimeView } | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const edit = () => { setChart(null); setSelectedPalace(null); setSelectedStar(null); setSelectedSiHua(null); window.scrollTo({ top: 0 }); };
  if (!chart) return <main className="max-w-2xl mx-auto px-4 py-10"><Link href="/" className="underline">← 首页</Link><h1 className="text-2xl my-4" style={{ color: 'var(--ac)' }}>紫微斗数排盘</h1><p className="text-sm mb-6">填写出生日期、时间与性别；不确定时辰可明确选择未知。</p><BirthForm initialData={form} onFormSave={setForm} onSubmit={info => { setChart(generateChart(info)); window.scrollTo({ top: 0 }); }} /></main>;
  return <main className="max-w-7xl mx-auto px-4 py-6">
    <nav className="flex flex-wrap gap-3 mb-4"><Link className="ux-button" href="/">首页</Link><button className="ux-button" onClick={edit}>补充信息 / 重新排盘</button><Link className="ux-button" href="/glossary">术语表</Link></nav>
    {chart.birthInfo.birthTimeKnown === false && <div className="ux-notice mb-4" role="note"><strong>出生时辰未知</strong><p>时辰未知时命宫、身宫和各宫排布不可靠，结果仅供参考。</p><button className="ux-button mt-2" onClick={edit}>补充时辰重新排盘</button></div>}
    {chart.birthInfo.timeCorrectionNotice && <div className="ux-notice mb-4">{chart.birthInfo.timeCorrectionNotice}。<button className="underline" onClick={() => { if (form) setForm({ ...form, useTrueSolar: false }); edit(); }}>改按钟表时间重新排盘</button></div>}
    {chart.birthInfo.origInput?.clockHour === 23 && <p className="ux-notice mb-4">原始输入为晚子时，本页沿用原设置按本日排盘；0 点至 1 点也按本日处理。</p>}
    <ResultGuide />
    {!mobileInfoClosed && (selectedPalace || selectedSiHua) && <aside className="mobile-selection-preview ux-notice" aria-label="手机本地简介"><div className="flex justify-between gap-2"><strong>{selectedStar?.name ?? selectedSiHua?.starName ?? selectedPalace?.name} · 本地简介</strong><button aria-label="收起手机简介" onClick={() => setMobileInfoClosed(true)}>×</button></div><p className="text-sm my-1">{termDescription(selectedStar?.name ?? (selectedSiHua ? `化${selectedSiHua.siHua}` : selectedPalace?.name ?? '主星'))}</p><button className="underline text-sm" onClick={() => { document.getElementById('ai-reading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMobileInfoClosed(true); }}>查看完整简介与 AI 面板 →</button></aside>}
    <div className="result-layout">
      <div className="min-w-0 space-y-5"><ChartBoard chart={chart} timeView={view} liunianYear={year} onViewChange={setView} onYearChange={setYear}
        onPalaceSelect={p => { setMobileInfoClosed(false); setSelectedPalace(p); setSelectedStar(null); setSelectedSiHua(null); }}
        onStarSelect={(s, p) => { setMobileInfoClosed(false); setSelectedPalace(p); setSelectedStar(s); setSelectedSiHua(null); }}
        onSiHuaClick={(starName, siHua, v) => { setMobileInfoClosed(false); setSelectedSiHua({ starName, siHua, view: v }); setSelectedStar(null); }} />
        <ChartSummary chart={chart} />
      </div>
      <div id="ai-reading" className="min-w-0 scroll-mt-4"><StarDetailPanel star={selectedStar} palaceName={selectedPalace?.name} onClose={() => setSelectedStar(null)} /><InsightPanel chart={chart} selectedPalace={selectedPalace} selectedStar={selectedStar} selectedSiHua={selectedSiHua} view={buildAiView(chart, view, year)} /></div>
    </div>
  </main>;
}
