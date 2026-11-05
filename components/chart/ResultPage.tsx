"use client";

import { useState } from "react";
import type { Palace, Star, ZiweiChart } from "@/lib/ziwei/types";
import ChartBoard from "@/components/ChartBoard";
import InsightPanel from "@/components/InsightPanel";
import Term from '@/components/Term';
import { termDescription } from '@/lib/glossary';
import StarDetailPanel from '@/components/StarDetailPanel';
import ResultGuide from '@/components/ResultGuide';
import { buildAiView, type TimeView } from '@/components/TimeNav';
import ChartMetaBar from "./ChartMetaBar";
import { formatBirthDate } from '@/lib/birth-time';
import { SHICHEN } from '@/lib/ziwei/constants';
import { Button } from '@/components/ui/Button';

export interface ResultPageProps {
  chart: ZiweiChart;
  onReset: () => void;
  useTrueSolar?: boolean;
}

/**
 * 命盘结果页：
 * 顶部命盘信息条；桌面两栏（左：运限 + 4×4 命盘 + 图例，右：AI 解读）；
 * 移动端单列（命盘在上、AI 在下），说明文字与操作均为 ≥36px 触控目标。
 */
export default function ResultPage({ chart, onReset, useTrueSolar }: ResultPageProps) {
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);

  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string; view: TimeView } | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [year, setYear] = useState(new Date().getFullYear());
  const handlePalaceSelect = (palace: Palace) => {
    setSelectedPalace(palace); setSelectedStar(null); setSelectedSiHua(null);
  };

  const { birthInfo } = chart;
  const chartDate = formatBirthDate(birthInfo);
  const inputDate = birthInfo.origInput && formatBirthDate(birthInfo.origInput);
  const askAi = () => document.getElementById('chart-ai')!.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="container-wide py-6 md:py-8">
      <ChartMetaBar chart={chart} onReset={onReset} useTrueSolar={useTrueSolar} />
      <Button variant="secondary" className="my-3 w-full lg:hidden" onClick={askAi}>AI 解读 · 点这里直接问</Button>
      {birthInfo.timeBasis ? <p role="note" className="ux-notice my-3">你选了「{birthInfo.timeBasis.segmentLabel}」，按中间 {birthInfo.timeBasis.clock} 排盘，出生地校正后为{SHICHEN[birthInfo.hour].name}。想更准，重新起盘填具体时间。</p>
        : birthInfo.birthTimeKnown === false ? <p role="note" className="ux-notice my-3">出生时辰未知，以子时占位，只看生年四化和流年大方向。</p>
        : inputDate && chartDate !== inputDate && <p role="note" className="ux-notice my-3">按出生地校正后，排盘日是 {chartDate}（{chartDate > inputDate ? '次日' : '前一日'}）。</p>}
      <ResultGuide />

      <div className="mt-5 grid gap-5 md:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(350px,400px)] lg:items-start lg:gap-8">
        <section aria-label="命盘" className="min-w-0">
          <ChartBoard chart={chart} timeView={view} liunianYear={year} onViewChange={v => { setView(v); setSelectedSiHua(null); }} onYearChange={y => { setYear(y); setSelectedSiHua(null); }} onPalaceSelect={handlePalaceSelect}
            onStarSelect={(star, palace) => { setSelectedStar(star); setSelectedPalace(palace); setSelectedSiHua(null); }}
            onSiHuaClick={(starName, siHua, v) => { setSelectedStar(null); setSelectedSiHua({ starName, siHua, view: v }); }} />
          {(selectedPalace || selectedSiHua) && <div className="ux-notice mt-3 lg:hidden" aria-label="手机简介"><strong><Term name={selectedStar?.name ?? (selectedSiHua ? `化${selectedSiHua.siHua}` : selectedPalace!.name)} /> · 简介</strong><p>{termDescription(selectedStar?.name ?? (selectedSiHua ? `化${selectedSiHua.siHua}` : selectedPalace!.name))}</p><Button variant="secondary" size="sm" onClick={askAi}>问 AI</Button></div>}
        </section>

        <aside
          id="chart-ai"
          aria-label="AI 解读"
          className="min-w-0 scroll-mt-[calc(var(--header-h)_+_1rem)]"
        >
          <StarDetailPanel star={selectedStar} palaceName={selectedPalace?.name} onClose={() => setSelectedStar(null)} />
          <InsightPanel
            chart={chart}
            selectedPalace={selectedPalace}
            selectedStar={selectedStar}
            selectedSiHua={selectedSiHua}
            view={buildAiView(chart, view, year)}
            className="min-h-[420px]"
          />
        </aside>
      </div>
    </div>
  );
}
