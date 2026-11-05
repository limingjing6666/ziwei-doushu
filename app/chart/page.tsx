"use client";

import { useEffect, useState } from "react";
import BirthPage from "@/components/birth/BirthPage";
import ResultPage from "@/components/chart/ResultPage";
import CandidateResultPage from "@/components/chart/CandidateResultPage";
import { buildCandidateResult, type ChartResult } from '@/lib/ziwei/fuzzy-time';
import { generateChart } from "@/lib/ziwei/algorithm";
import { restoreBirthSession, serializeBirthSession } from "@/lib/birth-session";
import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from "@/lib/ziwei/types";

const SESSION_KEY = 'tianjipan-chart';

/**
 * 排盘页：先出生信息，再命盘结果；本次浏览会话内保留输入与结果。
 */
export default function ChartPage() {
  const [form, setForm] = useState<BirthFormState | undefined>();
  const [result, setResult] = useState<ChartResult | null>(null);
  const [candidateError, setCandidateError] = useState('');
  const [useTrueSolar, setUseTrueSolar] = useState<boolean | undefined>();
  const [restored, setRestored] = useState(false);
  const [dateNotice, setDateNotice] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const data = restoreBirthSession(saved);
      setForm(data.form);
      setResult(data.chart ? { kind: 'single', chart: data.chart } : null);
      setUseTrueSolar(data.useTrueSolar);
      setDateNotice(data.dateNotice ?? '');
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) sessionStorage.setItem(SESSION_KEY, serializeBirthSession({ form, chart: result?.kind === 'single' ? result.chart : null, useTrueSolar }));
  }, [form, result, useTrueSolar, restored]);

  if (!restored) return null;
  if (!result) {
    return (
      <>
        {candidateError && <p role="alert" className="container-page pt-4 text-sm text-cinnabar">{candidateError}</p>}
        <BirthPage
          initialData={form}
          initialDateNotice={dateNotice}
          onFormSave={setForm}
          onStart={(info: BirthInfo) => {
            setResult({ kind: 'single', chart: generateChart(info) });
            setCandidateError('');
            setUseTrueSolar(form?.useTrueSolar !== false);
            setDateNotice('');
            // 只回到命盘顶部，绝不跳往 AI 区。
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
          onFuzzySubmit={input => {
            const evaluatedAt = new Date();
            try {
              setResult(buildCandidateResult(input, evaluatedAt));
              setCandidateError('');
              setDateNotice('');
              window.scrollTo({ top: 0, behavior: 'instant' });
            } catch {
              setCandidateError('未能完整生成候选，请检查日期、城市和时段');
            }
          }}
        />
      </>
    );
  }

  if (result.kind === 'candidates') return <CandidateResultPage candidates={result.candidates} context={result.context} onReset={() => setResult(null)} />;
  return <ResultPage chart={result.chart} useTrueSolar={useTrueSolar} onReset={() => setResult(null)} />;
}
