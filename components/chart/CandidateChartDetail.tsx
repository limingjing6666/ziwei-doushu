"use client";

import { useState } from 'react';
import ChartBoard from '@/components/ChartBoard';
import StarDetailPanel from '@/components/StarDetailPanel';
import Term from '@/components/Term';
import type { TimeView } from '@/components/TimeNav';
import { Button } from '@/components/ui/Button';
import { termDescription } from '@/lib/glossary';
import type { Candidate, FuzzyContext } from '@/lib/ziwei/fuzzy-time';
import type { Palace, Star } from '@/lib/ziwei/types';

export default function CandidateChartDetail({ candidate, context, label, onBack }: Readonly<{
  candidate: Candidate;
  context: FuzzyContext;
  label: string;
  onBack: () => void;
}>) {
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string } | null>(null);
  const [view, setView] = useState<TimeView>('mingpan');
  const [year, setYear] = useState(context.evaluatedDate.year);
  const date = context.evaluatedDate;

  return (
    <div className="container-page min-w-0 py-6 md:py-8">
      <Button variant="secondary" onClick={onBack}>返回对照</Button>
      <h1 className="mt-4 break-words font-serif text-xl font-semibold">{label} · 候选整盘</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">这是所选时段内的一个候选，不是已确认的出生时辰。排盘日以标题日期为准，未代填具体时分。</p>
      <p className="mt-2 text-xs text-ink-3">评估日期：{date.year}-{String(date.month).padStart(2, '0')}-{String(date.day).padStart(2, '0')}（本地）；当前年龄与大限沿用本批次，切换流年不会重算。</p>
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,760px)_minmax(0,1fr)] lg:items-start">
        <section aria-label="候选命盘" className="min-w-0">
          <ChartBoard chart={candidate.chart} timeView={view} liunianYear={year}
            onViewChange={value => { setView(value); setSelectedSiHua(null); }}
            onYearChange={value => { setYear(value); setSelectedSiHua(null); }}
            onPalaceSelect={palace => { setSelectedPalace(palace); setSelectedStar(null); setSelectedSiHua(null); }}
            onStarSelect={(star, palace) => { setSelectedStar(star); setSelectedPalace(palace); setSelectedSiHua(null); }}
            onSiHuaClick={(starName, siHua) => { setSelectedStar(null); setSelectedSiHua({ starName, siHua }); }} />
        </section>
        <aside aria-label="本地星宫简介" className="min-w-0 break-words text-sm leading-7 text-ink-2">
          <h2 className="font-serif text-lg font-semibold text-ink">星宫简介</h2>
          {!selectedPalace && <p>点选宫位、星曜或四化，可查看本地简介。</p>}
          {selectedPalace && <div className="ux-notice mt-3">
            <h3><Term name={selectedPalace.name} /></h3>
            <p>{termDescription(selectedPalace.name)}</p>
            <p>主星：{selectedPalace.stars.filter(star => star.type === 'major').map(star => star.name).join('、') || '空宫，可参考对宫主星'}</p>
          </div>}
          <StarDetailPanel star={selectedStar} palaceName={selectedPalace?.name} onClose={() => setSelectedStar(null)} />
          {selectedSiHua && <div className="ux-notice mt-3">
            <h3>{selectedSiHua.starName} · <Term name={`化${selectedSiHua.siHua}`} /></h3>
            <p>{termDescription(`化${selectedSiHua.siHua}`)}</p>
          </div>}
        </aside>
      </div>
    </div>
  );
}
