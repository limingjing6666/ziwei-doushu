"use client";

import type { AiView } from '@/lib/ai/input';
import Term from './Term';
import { STEMS, SI_HUA_TABLE } from "@/lib/ziwei/constants";
import type { ZiweiChart } from "@/lib/ziwei/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { SegmentedOption } from "@/components/ui/SegmentedControl";
import { IconButton } from "@/components/ui/IconButton";
import { SiHuaBadge } from "@/components/ui/Badge";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export function buildAiView(chart: ZiweiChart, view: TimeView, year: number): AiView & { transformations: Record<string, unknown> } {
  const dx = chart.daXians[chart.currentDaXianIndex];
  const p = dx && chart.palaces.find(p => p.branch === dx.palaceBranch);
  return { type: view === 'mingpan' ? 'natal' : view === 'daxian' ? 'decadal' : 'yearly', year,
    decadal: dx && p ? { startAge: dx.startAge, endAge: dx.endAge, palaceName: dx.palaceName, stem: p.stem } : undefined,
    transformations: { natal: chart.palaces.flatMap(p => p.stars.filter(s => s.siHua).map(s => ({ star: s.name, siHua: s.siHua, palace: p.name }))), decadal: p ? buildSiHuaOverlay(p.stem) : {}, yearly: buildSiHuaOverlay(getYearStemIndex(year)) } };
}

export type TimeView = "mingpan" | "daxian" | "liunian";

export interface TimeNavProps {
  chart: ZiweiChart;
  view: TimeView;
  liunianYear: number;
  onViewChange: (view: TimeView) => void;
  onYearChange: (year: number) => void;
}

/** 由年份计算天干索引 (0-9) */
export function getYearStemIndex(year: number): number {
  return (((year - 4) % 10) + 10) % 10;
}

/** 根据天干索引返回四化映射：starName → SiHua */
export function buildSiHuaOverlay(stemIndex: number): Record<string, string> {
  const stars = SI_HUA_TABLE[stemIndex];
  if (!stars) return {};
  return {
    [stars[0]]: "禄",
    [stars[1]]: "权",
    [stars[2]]: "科",
    [stars[3]]: "忌",
  };
}

const VIEW_OPTIONS: SegmentedOption<TimeView>[] = [
  { value: "mingpan", label: "本命" },
  { value: "daxian", label: "大限" },
  { value: "liunian", label: "流年" },
];

const SIHUA_ORDER = ["禄", "权", "科", "忌"] as const;

/** 运限切换：本命 / 大限 / 流年 + 流年年份步进 + 叠加四化说明。 */
export default function TimeNav({
  chart,
  view,
  liunianYear,
  onViewChange,
  onYearChange,
}: TimeNavProps) {
  const currentDx = chart.daXians[chart.currentDaXianIndex];

  const overlayInfo = ((): { stemName: string; overlay: Record<string, string> } | null => {
    if (view === "mingpan") return null;

    if (view === "daxian" && currentDx) {
      const dxPalace = chart.palaces.find((palace) => palace.branch === currentDx.palaceBranch);
      if (!dxPalace) return null;
      return {
        stemName: STEMS[dxPalace.stem] ?? "",
        overlay: buildSiHuaOverlay(dxPalace.stem),
      };
    }

    if (view === "liunian") {
      const stemIndex = getYearStemIndex(liunianYear);
      return {
        stemName: STEMS[stemIndex] ?? "",
        overlay: buildSiHuaOverlay(stemIndex),
      };
    }

    return null;
  })();

  const stepYear = (delta: number) => {
    onYearChange(Math.max(1900, Math.min(2100, liunianYear + delta)));
    if (view !== "liunian") onViewChange("liunian");
  };

  return (
    <div className="mb-3 min-w-0">
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-ink-3"><span>概念：</span><Term name="本命" /><Term name="大限" /><Term name="流年" /><Term name="四化" /></div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-[12px] tracking-[0.16em] text-ink-3 sm:inline">运限</span>
          <SegmentedControl<TimeView>
            options={VIEW_OPTIONS}
            value={view}
            onChange={onViewChange}
            ariaLabel="运限视图"
            className="[&_button]:!h-9 [&_button]:px-3.5"
          />
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton label="查看上一年流年" onClick={() => stepYear(-1)}>
            <IconChevronLeft size={16} />
          </IconButton>
          <span
            aria-live="polite"
            className="min-w-[4.5em] text-center font-mono text-[13px] tabular-nums text-ink-2"
          >
            {liunianYear}
          </span>
          <IconButton label="查看下一年流年" onClick={() => stepYear(1)}>
            <IconChevronRight size={16} />
          </IconButton>
        </div>
      </div>

      {overlayInfo ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/12 pt-2 text-[12px] leading-relaxed text-ink-3">
          <span>
            {view === "daxian" ? "大限" : "流年"} · {overlayInfo.stemName}年四化
          </span>
          {SIHUA_ORDER.map((siHua) => {
            const starName = Object.keys(overlayInfo.overlay).find(
              (name) => overlayInfo.overlay[name] === siHua,
            );
            if (!starName) return null;
            return (
              <span key={siHua} className="inline-flex items-center gap-1 text-ink-2">
                {starName}
                <Term name={`化${siHua}`}><SiHuaBadge siHua={siHua} overlay label={view === "daxian" ? "限" : "年"} /></Term>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 border-t border-line/12 pt-2 text-[12px] leading-relaxed text-ink-3">
          {view === "daxian"
            ? "尚未进入大限，暂无叠加四化"
            : "本命四化已标注在宫位星曜旁"}
        </p>
      )}
    </div>
  );
}
