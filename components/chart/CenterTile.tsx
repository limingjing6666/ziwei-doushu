import type { ZiweiChart } from "@/lib/ziwei/types";
import { BRANCHES, STEMS } from "@/lib/ziwei/constants";

/** 命盘中央信息区：命宫 / 身宫 / 五行局 / 农历 / 当前大限（纯文字，不用符号）。 */
export default function CenterTile({ chart }: { chart: ZiweiChart }) {
  const dx = chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : undefined;
  const lunarYear = `${STEMS[chart.lunarInfo.yearStem] ?? ""}${BRANCHES[chart.lunarInfo.yearBranch] ?? ""}年`;
  const lunarMonth = `${chart.lunarInfo.isLeapMonth ? "闰" : ""}${Math.abs(chart.lunarInfo.lunarMonth)}月`;

  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 px-3 py-4 text-center">
      <span className="text-[12px] tracking-[0.3em] text-ink-3">本命盘</span>
      <span aria-hidden="true" className="h-px w-8 bg-line/25" />

      <div className="flex items-center justify-center gap-3">
        <span className="text-[12px] text-ink-3">
          命宫
          <span className="ml-1 font-serif text-[14px] font-semibold text-cinnabar">
            {BRANCHES[chart.mingGongBranch]}
          </span>
        </span>
        <span aria-hidden="true" className="h-3 w-px bg-line/25" />
        <span className="text-[12px] text-ink-3">
          身宫
          <span className="ml-1 font-serif text-[14px] font-semibold text-ink">
            {BRANCHES[chart.shenGongBranch]}
          </span>
        </span>
      </div>

      <span className="text-[12px] text-ink-3">
        五行局 <span className="font-medium text-ink-2">{chart.wuxingJuName}</span>
      </span>
      <span className="text-[12px] text-ink-3">
        {lunarYear} · {lunarMonth}
        {chart.lunarInfo.lunarDay}日
      </span>

      <div className="mt-1 flex flex-col items-center gap-1 border-t border-line/12 pt-2">
        <span className="text-[12px] text-ink-3">虚岁 {chart.currentAge} · 当前大限</span>
        {dx ? (
          <span className="font-mono text-[13px] font-medium tabular-nums text-ink">
            {dx.startAge}–{dx.endAge} 岁 · {dx.palaceName}
          </span>
        ) : (
          <span className="text-[12px] text-ink-3">未入大限</span>
        )}
      </div>
    </div>
  );
}
