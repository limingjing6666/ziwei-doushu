"use client";

import { useState } from "react";
import BirthPage from "@/components/birth/BirthPage";
import ResultPage from "@/components/chart/ResultPage";
import { generateChart } from "@/lib/ziwei/algorithm";
import type { BirthInfo, ZiweiChart } from "@/lib/ziwei/types";

/**
 * 排盘页：先出生信息，再命盘结果。
 * 当前为 UI 重构阶段的编排层；结果页复用用户本次输入，刷新后回到起盘页。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);

  if (!chart) {
    return (
      <BirthPage
        onStart={(info: BirthInfo) => {
          setChart(generateChart(info));
        }}
      />
    );
  }

  return <ResultPage chart={chart} onReset={() => setChart(null)} />;
}
