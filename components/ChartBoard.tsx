"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Palace, Star, ZiweiChart } from "@/lib/ziwei/types";
import PalaceCell from "./PalaceCell";
import TimeNav, { buildSiHuaOverlay, getYearStemIndex, type TimeView } from "./TimeNav";
import CenterTile from "@/components/chart/CenterTile";
import ChartLegend from "@/components/chart/ChartLegend";
import { cn } from "@/lib/ui/cn";

export interface ChartBoardProps {
  chart: ZiweiChart;
  /** 点击星曜查看本地详情。 */
  onStarSelect?: (star: Star, palace: Palace) => void;
  onPalaceSelect?: (palace: Palace) => void;
  timeView?: TimeView;
  liunianYear?: number;
  onViewChange?: (view: TimeView) => void;
  onYearChange?: (year: number) => void;
  onSiHuaClick?: (starName: string, siHua: string, view: TimeView) => void;
}

/** 地支 → 4×4 盘面行列（巳午未申在顶行，顺时针排布，中央为 2×2 信息区）。 */
const BRANCH_GRID_POS: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

/** 行列 → 静态 grid 定位 class（避免内联样式，样式只来自 tailwind 层）。 */
const GRID_POS_CLASS: Record<string, string> = {
  "1-1": "col-start-1 row-start-1",
  "1-2": "col-start-2 row-start-1",
  "1-3": "col-start-3 row-start-1",
  "1-4": "col-start-4 row-start-1",
  "2-1": "col-start-1 row-start-2",
  "2-4": "col-start-4 row-start-2",
  "3-1": "col-start-1 row-start-3",
  "3-4": "col-start-4 row-start-3",
  "4-1": "col-start-1 row-start-4",
  "4-2": "col-start-2 row-start-4",
  "4-3": "col-start-3 row-start-4",
  "4-4": "col-start-4 row-start-4",
};

/**  DOM 顺序按盘面行优先排列，保证 Tab 顺序稳定。 */
const RENDER_ORDER = [5, 6, 7, 8, 4, 9, 3, 10, 2, 1, 0, 11];

/** 三方四正：本宫 + 对宫 + 两个三合宫 */
function getSanFangSiZheng(branch: number): [number, number, number, number] {
  return [
    branch,
    (branch + 6) % 12, // 对宫
    (branch + 4) % 12, // 三合 1
    (branch + 8) % 12, // 三合 2
  ];
}

interface CenterPoint {
  x: number;
  y: number;
}

/**
 * 命盘区：运限切换 + 4×4 印刷表格宫格 + 三方四正 SVG 连线 + 图例。
 * 宫位选中状态在本组件内维护，选中时通过 onPalaceSelect 通知上层（联动 AI 解读）。
 */
export default function ChartBoard({ chart, onPalaceSelect, onStarSelect, onSiHuaClick, timeView: controlledView, liunianYear: controlledYear, onViewChange, onYearChange }: ChartBoardProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [localView, setLocalView] = useState<TimeView>('mingpan');
  const [localYear, setLocalYear] = useState(new Date().getFullYear());
  const timeView = controlledView ?? localView;
  const liunianYear = controlledYear ?? localYear;
  const setTimeView = (view: TimeView) => { setLocalView(view); onViewChange?.(view); };
  const setLiunianYear = (year: number) => { setLocalYear(year); onYearChange?.(year); };

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [centers, setCenters] = useState<Record<number, CenterPoint>>({});

  const palaceMap = useMemo(() => {
    const map: Record<number, Palace> = {};
    chart.palaces.forEach((palace) => {
      map[palace.branch] = palace;
    });
    return map;
  }, [chart]);

  // 运限叠加四化：大限取当前大限宫干，流年取当年年干
  const overlay = useMemo(() => {
    if (timeView === "daxian") {
      const currentDx = chart.daXians[chart.currentDaXianIndex];
      const dxPalace = currentDx
        ? chart.palaces.find((palace) => palace.branch === currentDx.palaceBranch)
        : undefined;
      return {
        label: "限" as const,
        data: dxPalace ? buildSiHuaOverlay(dxPalace.stem) : {},
      };
    }
    if (timeView === "liunian") {
      return { label: "年" as const, data: buildSiHuaOverlay(getYearStemIndex(liunianYear)) };
    }
    return { label: undefined, data: {} as Record<string, string> };
  }, [chart, timeView, liunianYear]);

  const overlayActive = Object.keys(overlay.data).length > 0;

  // 三方四正连线需要宫格的实际中心点：布局随内容回流，所以用 DOM 实测
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      const gridRect = grid.getBoundingClientRect();
      const next: Record<number, CenterPoint> = {};
      grid.querySelectorAll<HTMLElement>("[data-palace-branch]").forEach((node) => {
        const branch = Number(node.dataset.palaceBranch);
        const cell = node.getBoundingClientRect();
        next[branch] = {
          x: cell.left - gridRect.left + cell.width / 2,
          y: cell.top - gridRect.top + cell.height / 2,
        };
      });
      setCenters(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [chart, timeView, liunianYear, overlayActive]);

  const handlePalaceClick = (branch: number) => {
    setSelectedBranch(branch);
    const palace = palaceMap[branch];
    if (palace) onPalaceSelect?.(palace);
  };

  const sanFang = selectedBranch !== null ? getSanFangSiZheng(selectedBranch) : null;
  const sanFangSet = sanFang ? new Set(sanFang) : null;
  const sanFangPoints =
    sanFang && sanFang.every((branch) => centers[branch]) ? sanFang.map((b) => centers[b]) : null;

  return (
    <div className="w-full select-none">
      <div className="mx-auto w-full max-w-[760px]">
        <TimeNav
          chart={chart}
          view={timeView}
          liunianYear={liunianYear}
          onViewChange={setTimeView}
          onYearChange={setLiunianYear}
        />

        <div
          ref={gridRef}
          role="group"
          aria-label="十二宫命盘"
          className="relative grid grid-cols-4 gap-px border border-line/20 bg-line/12"
        >
          {RENDER_ORDER.map((branch) => {
            const [row, col] = BRANCH_GRID_POS[branch];
            const palace = palaceMap[branch];
            if (!palace) return null;
            return (
              <div
                key={branch}
                className={cn(
                  "flex min-w-0 min-h-[112px] bg-paper sm:min-h-[128px]",
                  GRID_POS_CLASS[`${row}-${col}`],
                )}
              >
                <PalaceCell
                  palace={palace}
                  onClick={() => handlePalaceClick(branch)}
                  onStarClick={star => { setSelectedBranch(branch); onStarSelect?.(star, palace); }}
                  onSiHuaClick={(starName, siHua) => { setSelectedBranch(branch); onPalaceSelect?.(palace); onSiHuaClick?.(starName, siHua, timeView); }}
                  isSelected={selectedBranch === branch}
                  isSanFang={!!(sanFangSet?.has(branch) && selectedBranch !== branch)}
                  overlayStarSiHua={overlayActive ? overlay.data : undefined}
                  overlayLabel={overlay.label}
                />
              </div>
            );
          })}

          {/* 中央信息区：跨 2×2 宫格，盖住穿心连线 */}
          <div className="relative z-10 col-span-2 col-start-2 row-span-2 row-start-2 flex bg-surface">
            <CenterTile chart={chart} />
          </div>

          {/* 三方四正：朱砂虚线，运行时几何才允许内联坐标 */}
          {sanFangPoints ? (
            <svg
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none absolute inset-0 z-[5] h-full w-full animate-fade-in"
            >
              {[
                [0, 1],
                [0, 2],
                [2, 3],
                [3, 0],
              ].map(([from, to]) => (
                <line
                  key={`${from}-${to}`}
                  x1={sanFangPoints[from].x}
                  y1={sanFangPoints[from].y}
                  x2={sanFangPoints[to].x}
                  y2={sanFangPoints[to].y}
                  stroke="currentColor"
                  strokeWidth={1.25}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="text-cinnabar/50"
                />
              ))}
            </svg>
          ) : null}
        </div>

        <ChartLegend />
      </div>
    </div>
  );
}
