"use client";

import { useState } from "react";
import BirthPage from "@/components/birth/BirthPage";
import ResultPage from "@/components/chart/ResultPage";
import { generateChart } from "@/lib/ziwei/algorithm";
import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo, ZiweiChart } from "@/lib/ziwei/types";

/**
 * 排盘页：先出生信息，再命盘结果。
 * 当前为 UI 重构阶段的编排层；结果页复用用户本次输入，刷新后回到起盘页。
 */
export default function ChartPage() {
  const [form, setForm] = useState<BirthFormState | undefined>();
  const [chart, setChart] = useState<ZiweiChart | null>(null);

  if (!chart) {
    return (
      <BirthPage
        initialData={form}
        onFormSave={setForm}
        onStart={(info: BirthInfo) => {
          setChart(generateChart(info));
          // 只回到命盘顶部，绝不跳往 AI 区。
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  return <ResultPage chart={chart} onReset={() => setChart(null)} />;
}
