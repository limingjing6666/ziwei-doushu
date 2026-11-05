"use client";

import { useEffect, useState } from "react";
import BirthPage from "@/components/birth/BirthPage";
import ResultPage from "@/components/chart/ResultPage";
import { generateChart } from "@/lib/ziwei/algorithm";
import { restoreBirthSession } from "@/lib/birth-session";
import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo, ZiweiChart } from "@/lib/ziwei/types";

const SESSION_KEY = 'tianjipan-chart';

/**
 * 排盘页：先出生信息，再命盘结果；本次浏览会话内保留输入与结果。
 */
export default function ChartPage() {
  const [form, setForm] = useState<BirthFormState | undefined>();
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [useTrueSolar, setUseTrueSolar] = useState<boolean | undefined>();
  const [restored, setRestored] = useState(false);
  const [dateNotice, setDateNotice] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const data = restoreBirthSession(saved);
      setForm(data.form);
      setChart(data.chart);
      setUseTrueSolar(data.useTrueSolar);
      setDateNotice(data.dateNotice ?? '');
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ form, chart, useTrueSolar }));
  }, [form, chart, useTrueSolar, restored]);

  if (!restored) return null;
  if (!chart) {
    return (
      <BirthPage
        initialData={form}
        initialDateNotice={dateNotice}
        onFormSave={setForm}
        onStart={(info: BirthInfo) => {
          setChart(generateChart(info));
          setUseTrueSolar(form?.useTrueSolar !== false);
          setDateNotice('');
          // 只回到命盘顶部，绝不跳往 AI 区。
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
      />
    );
  }

  return <ResultPage chart={chart} useTrueSolar={useTrueSolar} onReset={() => setChart(null)} />;
}
