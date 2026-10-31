'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import BirthForm, { type BirthFormState } from '@/components/birth/BirthForm';
import { Seal } from '@/components/brand';
import { IconCompatibility, IconInfo } from '@/components/icons';
import { AiProse } from '@/components/ui/AiProse';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Skeleton';
import { requestAi, classifyAiError, type AiClientError } from '@/lib/ai/client';
import { AiErrorNotice, AiLoading } from '@/components/AiStatus';
import { validateBirthForm } from '@/lib/birth-form';
import { buildAiView } from '@/components/TimeNav';
import { generateChart as buildChart } from '@/lib/ziwei/algorithm';
import { formToBirthInfo } from '@/lib/ziwei/share';
import type { ZiweiChart } from '@/lib/ziwei/types';

/** 分析完成后的快捷追问（沿用原有 5 个问题，只改视觉） */
const FOLLOW_UP_QUESTIONS = [
  '感情匹配度如何？',
  '适合合伙创业吗？',
  '两人结婚是否合适？',
  '哪方面最容易产生矛盾？',
  '财运是否互补？',
] as const;

/** 表单是否填齐：性别 + 年月日 + 出生时间（或勾选「时辰不详」） */
function isFormReady(form: BirthFormState | null): boolean {
  return !!form && Object.keys(validateBirthForm(form)).length === 0;
}

/** 甲 / 乙 单方出生信息卡：只负责外框、标签与完成度提示，表单本体由 BirthForm compact 变体提供。 */
function BirthSideCard({
  mark,
  title,
  ready,
  onFormSave,
}: {
  mark: string;
  title: string;
  ready: boolean;
  onFormSave: (data: BirthFormState) => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-line/12 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-line/20 bg-surface-2 font-serif text-[15px] font-semibold leading-none text-ink-2"
          >
            {mark}
          </span>
          <h2 className="font-serif text-[17px] font-semibold tracking-[0.04em] text-ink">
            {title}
          </h2>
        </div>
        <Badge tone={ready ? 'default' : 'muted'}>
          {ready ? '信息已就绪' : '待填写'}
        </Badge>
      </div>
      <div className="flex-1 p-4 sm:p-5">
        <BirthForm
          variant="compact"
          lateZishiRule="next-day"
          hideSubmit
          onSubmit={() => {}}
          onFormSave={onFormSave}
        />
      </div>
    </Card>
  );
}

export default function HemingPage() {
  // ─── 双方表单状态（由 BirthForm onFormSave 同步，统一按钮触发）──────
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);

  // ─── AI 合盘分析状态 ─────────────────────────────────────────────
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<AiClientError | null>(null);
  const [charts, setCharts] = useState<{ chartA: ZiweiChart; chartB: ZiweiChart } | null>(null);
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);
  const last = useRef<{ payload: Record<string, unknown>; index: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const analysisRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const startingRef = useRef(false);
  useEffect(() => () => requestRef.current?.abort(), []);

  const execute = async (payload: Record<string, unknown>, index: number) => {
    if (requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    last.current = { payload, index }; setAnalyzing(true); setError(null);
    try {
      await requestAi('/api/heming', payload, text => {
        if (index === -1) setAnalysis(text);
        else setTurns(prev => prev.map((turn, i) => i === index ? { ...turn, answer: text } : turn));
      }, controller.signal);
    } catch (e) { if (!controller.signal.aborted) setError(classifyAiError(e)); }
    finally { if (requestRef.current === controller) { requestRef.current = null; if (!controller.signal.aborted) setAnalyzing(false); } }
  };
  const runAnalysis = async (q?: string) => {
    if (requestRef.current || analyzing || startingRef.current) return;
    if (q?.trim() && charts) {
      const index = turns.length;
      setTurns(prev => [...prev, { question: q, answer: '' }]); setQuestion('');
      const year = new Date().getFullYear();
      await execute({ ...charts, question: q, mode: 'followup', reportSummary: analysis.slice(0, 1600),
        messages: turns.slice(-6).flatMap(t => [{ role: 'user', content: t.question.slice(0, 2000) }, { role: 'assistant', content: t.answer.slice(0, 2000) }]),
        viewA: buildAiView(charts.chartA, 'mingpan', year), viewB: buildAiView(charts.chartB, 'mingpan', year) }, index);
      return;
    }
    setFormError(null);
    const invalid = [formA, formB].findIndex(f => !isFormReady(f));
    if (invalid >= 0) {
      setFormError(`请检查${invalid === 0 ? '甲' : '乙'}方的出生信息`);
      document.querySelectorAll<HTMLFormElement>('form')[invalid]?.requestSubmit();
      return;
    }
    startingRef.current = true;
    setAnalyzing(true); setError(null);
    await new Promise(resolve => setTimeout(resolve, 32));
    try {
      const pair = { chartA: buildChart(formToBirthInfo(formA!)), chartB: buildChart(formToBirthInfo(formB!)) };
      setCharts(pair); setAnalysis(''); setTurns([]);
      const year = new Date().getFullYear();
      await execute({ ...pair, viewA: buildAiView(pair.chartA, 'mingpan', year), viewB: buildAiView(pair.chartB, 'mingpan', year), mode: 'overview', question: '【合盘总览】首句直答两人合不合，再分节说明相处特点、双方依据、互飞与摩擦、3条建议。' }, -1);
    } catch { setFormError('排盘未完成，请检查双方出生信息后重试'); setAnalyzing(false); }
    finally { startingRef.current = false; }
  };

  const handleFollowUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (analyzing) return;
    if (question.trim()) void runAnalysis(question);
  };

  return (
    <div className="container-page py-10 md:py-14">
      <PageHeader
        title="合盘"
        description="把两个人的命盘放在一起读：先各自起盘，再对照星曜、宫位与四化的互动。"
      />

      <hr className="rule-double mt-8" />

      {/* ─── 双栏 A / B 出生信息 ───────────────────────────────── */}
      <section
        aria-label="双方出生信息"
        className="mt-8 grid gap-6 md:mt-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch md:gap-8"
      >
        <BirthSideCard
          mark="甲"
          title="甲方"
          ready={isFormReady(formA)}
          onFormSave={setFormA}
        />

        {/* 中间分隔：移动端横线，桌面端竖线，以「合」字印居中 */}
        <div
          aria-hidden="true"
          className="flex items-center gap-3 md:flex-col md:gap-4 md:py-2"
        >
          <span className="h-px flex-1 bg-line/20 md:h-auto md:w-px" />
          <Seal size={30} label="合" />
          <span className="h-px flex-1 bg-line/20 md:h-auto md:w-px" />
        </div>

        <BirthSideCard
          mark="乙"
          title="乙方"
          ready={isFormReady(formB)}
          onFormSave={setFormB}
        />
      </section>

      {/* ─── 合盘分析：常显区域，按状态切换 ────────────────────── */}
      <section
        ref={analysisRef}
        aria-labelledby="heming-analysis-title"
        className="mt-8 scroll-mt-24 md:mt-12"
      >
        <Card>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/12 px-4 py-4 sm:px-6">
            <IconCompatibility size={20} className="shrink-0 text-ink-3" />
            <h2
              id="heming-analysis-title"
              className="font-serif text-[18px] font-semibold tracking-[0.03em] text-ink"
            >
              合盘分析
            </h2>
            {analyzing ? (
              <span className="ml-auto inline-flex items-center gap-2 text-[12px] text-ink-3">
                <Spinner label="正在生成解读" />
                正在生成
              </span>
            ) : null}
          </div>

          {formError ? (
            <div
              role="alert"
              className="mx-4 mt-4 flex items-start gap-2 rounded-sm border border-cinnabar/25 bg-cinnabar/5 px-3 py-2 text-[13px] leading-relaxed text-ink-2 sm:mx-6"
            >
              <IconInfo size={16} className="mt-0.5 shrink-0 text-cinnabar" />
              <p>{formError}</p>
            </div>
          ) : null}

          <div
            aria-busy={analyzing || undefined}
            className="min-h-[240px] px-4 py-6 sm:px-6"
          >
            {!analysis && !analyzing ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IconCompatibility size={32} className="text-ink-3" />
                <p className="mt-4 font-serif text-[18px] font-semibold text-ink">
                  尚未开始合盘
                </p>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-ink-3">
                  双方出生信息填写完整后，点击下方按钮开始。系统会先排出两张命盘，再生成对照解读。
                </p>
                <Button
                  size="lg"
                  className="mt-6"
                  onClick={() => void runAnalysis()}
                >
                  开始合盘
                </Button>
                <p className="mt-3 text-[12px] text-ink-3">
                  生成后可继续追问。
                </p>
              </div>
            ) : null}

            {analyzing && !analysis ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Spinner label="正在对照双方命盘" />
                <p className="mt-4 font-serif text-[16px] font-semibold text-ink">
                  正在对照双方命盘…
                </p>
                <p className="mt-1.5 text-[13px] text-ink-3">
                  先排出两张命盘，再由 AI 生成对照解读。
                </p>
              </div>
            ) : null}

            {charts && [charts.chartA, charts.chartB].map((c, i) => <div key={i}>{c.birthInfo.birthTimeKnown === false && <p className="ux-notice my-3">{i === 0 ? '甲方' : '乙方'}出生时辰未知，命宫、身宫与各宫排布不可靠，仅解读生年四化与流年的大方向。</p>}{c.birthInfo.timeCorrectionNotice && <p className="ux-notice my-3">{i === 0 ? '甲方' : '乙方'}：{c.birthInfo.timeCorrectionNotice}。可在表单改按钟表时间后重新合盘。</p>}</div>)}
            {analysis ? <div aria-label="原始合盘报告"><AiProse text={analysis} streaming={analyzing && last.current?.index === -1} /></div> : null}
            {analyzing && <AiLoading />}
            <AiErrorNotice error={error} loading={analyzing} retry={() => { if (last.current) void execute(last.current.payload, last.current.index); }} />
          </div>

          {/* ─── 分析完成后的追问区（沿用原有行为）──────────────── */}
          {analysis ? (
            <div className="border-t border-line/12 px-4 py-5 sm:px-6">
              <h3 className="font-serif text-[16px] font-semibold text-ink">
                继续追问
              </h3>
              <p className="mt-1 text-[13px] text-ink-3">
                基于本次合盘结果继续提问，原报告保持不变。
              </p>

              <div className="mt-4 space-y-4" aria-label="合盘追问对话">{turns.map((turn, i) => <Card key={i} className="p-3"><p className="mb-3 rounded-sm bg-surface-2 p-3 text-sm text-ink-2">{turn.question}</p><AiProse text={turn.answer} streaming={analyzing && last.current?.index === i} /></Card>)}</div>
              <Button variant="secondary" className="mt-4" disabled={analyzing} onClick={() => void runAnalysis()}>用当前表单重新合盘</Button>
              <div className="mt-4 flex flex-wrap gap-2">
                {FOLLOW_UP_QUESTIONS.map((item) => (
                  <Button
                    key={item}
                    variant="secondary"
                    size="md"
                    disabled={analyzing}
                    onClick={() => {
                      setQuestion(item);
                      void runAnalysis(item);
                    }}
                  >
                    {item}
                  </Button>
                ))}
              </div>

              <form
                onSubmit={handleFollowUp}
                className="mt-4 flex flex-col gap-2 sm:flex-row"
              >
                <label htmlFor="heming-followup" className="sr-only">
                  继续追问
                </label>
                <Input
                  id="heming-followup"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="继续追问，如：哪几年是两人感情关键期？"
                  disabled={analyzing}
                  className="min-w-0 flex-1 disabled:opacity-50"
                />
                <Button type="submit" disabled={analyzing || !question.trim()} className="shrink-0">
                  {analyzing ? '分析中…' : '发送'}
                </Button>
              </form>
            </div>
          ) : null}
        </Card>
      </section>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-ink-3">
        AI 生成内容可能出错，请自行核对；关系判断请回到现实沟通与选择。
      </p>
    </div>
  );
}
