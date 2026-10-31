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

export interface ResultPageProps {
  chart: ZiweiChart;
  onReset: () => void;
}

/**
 * 命盘结果页：
 * 顶部命盘信息条；桌面两栏（左：运限 + 4×4 命盘 + 图例，右：AI 解读）；
 * 移动端单列（命盘在上、AI 在下），说明文字与操作均为 ≥36px 触控目标。
 */
export default function ResultPage({ chart, onReset }: ResultPageProps) {
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);

  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string; view: TimeView } | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [year, setYear] = useState(new Date().getFullYear());
  const handlePalaceSelect = (palace: Palace) => {
    setSelectedPalace(palace); setSelectedStar(null); setSelectedSiHua(null);
  };

  return (
    <div className="container-wide py-6 md:py-8">
      <ChartMetaBar chart={chart} onReset={onReset} />
      {chart.birthInfo.birthTimeKnown === false && <p role="note" className="ux-notice my-3">出生时辰未知，命宫、身宫和各宫排布不可靠，当前以子时占位，仅供参考。</p>}
      {chart.birthInfo.timeCorrectionNotice && <p className="ux-notice my-3">{chart.birthInfo.timeCorrectionNotice}。可重新起盘改按钟表时间。</p>}
      {chart.birthInfo.origInput?.clockHour === 23 && <p className="ux-notice my-3">原始输入为晚子时，本页沿用本日排盘口径。</p>}
      <ResultGuide />

      <div className="mt-5 grid gap-5 md:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(350px,400px)] lg:items-start lg:gap-8">
        <section aria-label="命盘" className="min-w-0">
          <ChartBoard chart={chart} timeView={view} liunianYear={year} onViewChange={v => { setView(v); setSelectedSiHua(null); }} onYearChange={y => { setYear(y); setSelectedSiHua(null); }} onPalaceSelect={handlePalaceSelect}
            onStarSelect={(star, palace) => { setSelectedStar(star); setSelectedPalace(palace); setSelectedSiHua(null); }}
            onSiHuaClick={(starName, siHua, v) => { setSelectedStar(null); setSelectedSiHua({ starName, siHua, view: v }); }} />
          {(selectedPalace || selectedSiHua) && <div className="ux-notice mt-3 lg:hidden" aria-label="手机本地简介"><strong><Term name={selectedStar?.name ?? (selectedSiHua ? `化${selectedSiHua.siHua}` : selectedPalace!.name)} /> · 本地简介</strong><p>{termDescription(selectedStar?.name ?? (selectedSiHua ? `化${selectedSiHua.siHua}` : selectedPalace!.name))}</p><p className="text-xs text-ink-3">下方可查看完整简介与 AI 面板，点盘面不会请求 AI。</p></div>}
        </section>

        <aside
          aria-label="AI 解读"
          className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"
        >
          <StarDetailPanel star={selectedStar} palaceName={selectedPalace?.name} onClose={() => setSelectedStar(null)} />
          <InsightPanel
            chart={chart}
            selectedPalace={selectedPalace}
            selectedStar={selectedStar}
            selectedSiHua={selectedSiHua}
            view={buildAiView(chart, view, year)}
            className="min-h-[420px] max-h-[calc(100vh-var(--header-h)-2rem)]"
          />
        </aside>
      </div>
    </div>
  );
}
