"use client";

import { useState } from "react";
import type { Palace, ZiweiChart } from "@/lib/ziwei/types";
import ChartBoard from "@/components/ChartBoard";
import InsightPanel from "@/components/InsightPanel";
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

  const handlePalaceSelect = (palace: Palace) => {
    setSelectedPalace(palace);
  };

  return (
    <div className="container-wide py-6 md:py-8">
      <ChartMetaBar chart={chart} onReset={onReset} />

      <div className="mt-5 grid gap-5 md:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(350px,400px)] lg:items-start lg:gap-8">
        <section aria-label="命盘" className="min-w-0">
          <ChartBoard chart={chart} onPalaceSelect={handlePalaceSelect} />
        </section>

        <aside
          aria-label="AI 解读"
          className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"
        >
          <InsightPanel
            chart={chart}
            selectedPalace={selectedPalace}
            className="min-h-[420px] max-h-[calc(100vh-var(--header-h)-2rem)]"
          />
        </aside>
      </div>
    </div>
  );
}
