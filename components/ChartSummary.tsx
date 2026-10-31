'use client';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { Card } from './ui/Card';
import { Badge, SiHuaBadge } from './ui/Badge';
import Term from './Term';

/** 只摘要已有盘面数据，不在客户端引入服务端格局/RAG 模块。 */
export default function ChartSummary({ chart: c }: { chart: ZiweiChart }) {
  const ming = c.palaces.find(p => p.isMingGong);
  const majors = ming?.stars.filter(s => s.type === 'major').map(s => s.name).join('、');
  const b = c.birthInfo.origInput ?? c.birthInfo;
  return <Card className="mt-5 min-w-0 p-4 sm:p-5" role="region" aria-label="命盘摘要">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-serif text-lg text-ink">白话结论 · 命盘摘要</h2><Badge tone="muted">本地整理 · 非 AI 预测</Badge></div>
    <p className="my-4 text-sm leading-7 text-ink-2">这张盘的阅读起点是命宫{majors ? `里的${majors}` : '的空宫结构，可参考对宫主星'}。先看主星与三方四正，再结合四化和当前阶段，不凭一颗星下定论。</p>
    <dl className="grid grid-cols-1 gap-4 text-sm text-ink-2 sm:grid-cols-2">
      <div><dt className="text-ink-3"><Term name="命宫" /></dt><dd>{BRANCHES[c.mingGongBranch]} · {majors || '空宫（参考对宫）'}</dd></div>
      <div><dt className="text-ink-3"><Term name="身宫" /></dt><dd>{BRANCHES[c.shenGongBranch]}</dd></div>
      <div><dt className="text-ink-3"><Term name="五行局" /></dt><dd>{c.wuxingJuName}</dd></div>
      <div><dt className="text-ink-3"><Term name="三方四正" /></dt><dd>点选宫位可查看关联</dd></div>
    </dl>
    <div className="mt-4 border-t border-line/12 pt-3 text-sm leading-7 text-ink-2"><p>公历生日：{b.year}-{b.month}-{b.day}</p><p>农历：{c.lunarInfo.lunarYear}年 · {STEMS[c.lunarInfo.yearStem]}{BRANCHES[c.lunarInfo.yearBranch]}年 {c.lunarInfo.isLeapMonth ? '闰' : ''}{Math.abs(c.lunarInfo.lunarMonth)}月{c.lunarInfo.lunarDay}日</p><p>{c.birthInfo.birthTimeKnown === false ? '出生时辰未知 · 当前以子时占位' : `排盘时辰：${BRANCHES[c.birthInfo.hour]}时`}</p></div>
    <h3 className="mb-2 mt-4 text-sm"><Term name="四化">生年四化</Term></h3>
    <div className="grid grid-cols-2 gap-2 text-sm text-ink-2">{c.palaces.flatMap(p => p.stars.filter(s => s.siHua).map(s => <div key={s.name} className="min-w-0 rounded-sm border border-line/12 bg-surface-2 p-2"><span>{s.name} <Term name={`化${s.siHua}`}><SiHuaBadge siHua={s.siHua!} /></Term></span><p className="text-xs text-ink-3">{p.name}</p></div>))}</div>
    <details className="mt-4 text-sm text-ink-2"><summary className="cursor-pointer py-2">查看各阶段大限</summary><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{c.daXians.map((dx, i) => <div key={i} className={`min-w-0 rounded-sm border p-2 ${i === c.currentDaXianIndex ? 'border-cinnabar text-cinnabar' : 'border-line/20'}`}>{dx.startAge}–{dx.endAge}岁<p className="text-xs">{dx.palaceName}</p></div>)}</div></details>
  </Card>;
}
