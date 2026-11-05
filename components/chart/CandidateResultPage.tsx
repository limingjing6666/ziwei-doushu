"use client";

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Disclosure } from '@/components/ui/Disclosure';
import { compareCandidates, type ComparableDaXian, type ComparablePalace, type ComparedField } from '@/lib/ziwei/compare-candidates';
import { BRANCHES } from '@/lib/ziwei/constants';
import { SEGMENTS, type Candidate, type FuzzyContext } from '@/lib/ziwei/fuzzy-time';
import CandidateChartDetail from './CandidateChartDetail';

export type CandidateResultPageProps = Readonly<{
  candidates: readonly Candidate[];
  context: FuzzyContext;
  onReset: () => void;
}>;

type DisplayField = Readonly<{
  label: string;
  groups: readonly Readonly<{ value: string; candidateIds: readonly string[] }>[];
}>;
const palaceLabel = (value: ComparablePalace) => `${value.name}（${BRANCHES[value.branch]}）`;
const daXianLabel = (value: ComparableDaXian) => value
  ? `${palaceLabel(value.palace)} · ${value.startAge} 岁起限` : '无实际大限资料';
function displayField<T>(label: string, field: ComparedField<T>, format: (value: T) => string): DisplayField {
  return { label, groups: field.groups.map(group => ({ ...group, value: format(group.value) })) };
}

export default function CandidateResultPage({ candidates, context, onReset }: CandidateResultPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const comparison = useMemo(() => compareCandidates(candidates), [candidates]);
  const fields: DisplayField[] = comparison.natal.flatMap(item => {
    const identity = displayField(`生年化${item.mark}`, item.identity, value =>
      `${value.star}化${value.mark}${item.consistentPalace ? ` · ${palaceLabel(item.consistentPalace)}` : ''}`);
    if (item.consistentPalace) return [identity];
    // 身份不同时，即便恰好同宫，也不把落宫单独列作一致。
    const groups = item.palace.groups.flatMap(palace => item.identity.groups.map(identityGroup => ({
      value: `${item.identity.groups.length > 1 ? `${identityGroup.value.star}化${item.mark} · ` : ''}${palaceLabel(palace.value)}`,
      candidateIds: palace.candidateIds.filter(id => identityGroup.candidateIds.includes(id)),
    })).filter(group => group.candidateIds.length));
    return [identity, { label: `生年化${item.mark}落宫`, groups }];
  });
  fields.push(
    displayField('命宫', comparison.ming, palaceLabel),
    displayField('身宫', comparison.shen, palaceLabel),
    displayField('当前大限', comparison.currentDaXian, daXianLabel),
  );
  const same = fields.filter(field => field.groups.length === 1);
  const different = fields.filter(field => field.groups.length > 1);
  const segment = SEGMENTS.find(item => item.value === context.segment);
  if (!segment) throw new Error('大概时段非法');
  const dateLabel = (date: Candidate['chartDate']) => `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  const relativeBranch = (candidate: Candidate) => {
    const day = dateLabel(candidate.chartDate);
    const inputDay = dateLabel(context.dateInfo);
    return `${day === inputDay ? '本日' : day < inputDay ? '前一日' : '次日'} ${BRANCHES[candidate.branch]}`;
  };
  const candidateLabel = (candidate: Candidate) => `${dateLabel(candidate.chartDate)} · ${relativeBranch(candidate)}`;
  const labels = new Map(candidates.map(candidate => [candidate.id, candidateLabel(candidate)]));
  const selected = selectedId === null ? null : candidates.find(candidate => candidate.id === selectedId);
  if (selectedId !== null && !selected) throw new Error('候选不存在');
  const showCandidate = (id: string | null) => {
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (selected) return <CandidateChartDetail key={selected.id} candidate={selected} context={context}
    label={candidateLabel(selected)} onBack={() => showCandidate(null)} />;

  return (
    <div className="container-page min-w-0 break-words py-6 md:py-8">
      <header className="max-w-3xl">
        <h1 className="font-serif text-2xl font-semibold">大概时段 · 候选对照</h1>
        <p className="mt-4 text-sm leading-7 text-ink-2">你选的是「{segment.label}」。按出生地校正后，这个时段可能落到：{candidates.map(relativeBranch).join('、')}。下面是这些时辰各自排出的盘里，一致的部分和会随具体时辰变化的部分。这不是在猜你的真时辰，只是把不确定的地方摊开。</p>
        <p className="mt-2 text-xs leading-6 text-ink-3">原输入公历日：{dateLabel(context.dateInfo)}；出生地：{context.city.province} · {context.city.city}。固定按经度校正{context.dstApplied ? '，整个时段已减夏令时一小时' : '，未减夏令时'}；校正后 23:00 起归下一排盘日，各候选排盘日见下方。</p>
        <p className="mt-1 text-xs text-ink-3">评估日期：{dateLabel(context.evaluatedDate)}（本地），所有候选共用同一评估时刻。</p>
      </header>
      <div className="mt-5 max-w-3xl min-w-0">
        <Disclosure title={`一致（${same.length} 项）`} defaultOpen>
          <ul className="space-y-3">
            {same.map(field => <li key={field.label}>
              <p><strong>{field.label}</strong>：{field.groups[0].value}</p>
              <p className="text-xs text-ink-3">仅在所选时段的候选里一致，不代表任意出生时刻都成立</p>
            </li>)}
          </ul>
          {!same.length && <p>这些字段在本次候选中没有全体一致的项。</p>}
        </Disclosure>
        <Disclosure title={`分歧（${different.length} 项）`}>
          <div className="space-y-5">
            {different.map(field => <section key={field.label}>
              <h2 className="font-medium text-ink">{field.label} · {candidates.length} 盘 {field.groups.length} 个不同值</h2>
              <ul className="mt-2 space-y-2">
                {field.groups.map(group => <li key={group.value}>
                  <strong>{group.value}</strong> → {group.candidateIds.map(id => labels.get(id)).join('；')}
                </li>)}
              </ul>
            </section>)}
          </div>
          {!different.length && <p>这些字段在本次候选中均一致。</p>}
        </Disclosure>
        <section aria-label="候选列表" className="mt-6">
          <h2 className="font-serif text-lg font-semibold">逐个查看候选整盘</h2>
          <ul className="mt-3 space-y-3">
            {candidates.map(candidate => <li key={candidate.id}>
              <Button variant="secondary" className="h-auto min-h-11 w-full !whitespace-normal justify-start py-3 text-left"
                onClick={() => showCandidate(candidate.id)}>
                查看候选 · {candidateLabel(candidate)}
              </Button>
            </li>)}
          </ul>
        </section>
        <Button variant="secondary" className="mt-6" onClick={onReset}>重新填表</Button>
      </div>
    </div>
  );
}
