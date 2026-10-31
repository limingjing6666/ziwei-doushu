'use client';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import Term from './Term';
/** Summarize existing chart data only; server-side pattern/RAG modules stay server-only. */
export default function ChartSummary({ chart: c }: { chart: ZiweiChart }) {
  const ming = c.palaces.find(p => p.isMingGong);
  const b = c.birthInfo.origInput ?? c.birthInfo;
  return <section className="card rounded-xl p-4" aria-label="命盘摘要"><h2 className="text-lg mb-4" style={{ color: 'var(--ac)' }}>命盘摘要</h2>
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div><dt><Term name="命宫" /></dt><dd>{BRANCHES[c.mingGongBranch]} · {ming?.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫（参考对宫）'}</dd></div>
      <div><dt><Term name="身宫" /></dt><dd>{BRANCHES[c.shenGongBranch]}</dd></div>
      <div><dt><Term name="五行局" /></dt><dd>{c.wuxingJuName}</dd></div>
      <div><dt><Term name="三方四正" /></dt><dd>点选宫位可查看关联</dd></div>
    </dl>
    <div className="text-sm leading-7 mt-4 pt-3 border-t" style={{ borderColor: 'var(--bdr-med)' }}><p>公历生日：{b.year}-{b.month}-{b.day}</p><p>农历：{c.lunarInfo.lunarYear}年 · {STEMS[c.lunarInfo.yearStem]}{BRANCHES[c.lunarInfo.yearBranch]}年 {c.lunarInfo.isLeapMonth ? '闰' : ''}{Math.abs(c.lunarInfo.lunarMonth)}月{c.lunarInfo.lunarDay}日</p><p>{c.birthInfo.birthTimeKnown === false ? '出生时辰未知 · 当前以子时占位' : `排盘时辰：${BRANCHES[c.birthInfo.hour]}时`}</p></div>
    <h3 className="mt-4 mb-2"><Term name="四化">生年四化</Term></h3><div className="grid grid-cols-2 gap-2 text-sm">{c.palaces.flatMap(p => p.stars.filter(s => s.siHua).map(s => <div key={s.name} className="rounded-lg p-2" style={{ background: 'var(--ac-bg)' }}>{s.name}<Term name={`化${s.siHua}`} /><p className="text-xs">{p.name}</p></div>))}</div>
    <details className="mt-4"><summary className="cursor-pointer py-2">查看各阶段大限</summary><div className="grid grid-cols-3 gap-2 text-sm">{c.daXians.map((dx, i) => <div key={i} className="border rounded p-2" style={{ borderColor: i === c.currentDaXianIndex ? 'var(--ac)' : 'var(--bdr-med)' }}>{dx.startAge}–{dx.endAge}岁<p className="text-xs">{dx.palaceName}</p></div>)}</div></details>
  </section>;
}
