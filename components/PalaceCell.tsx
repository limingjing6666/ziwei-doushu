"use client";

import type { Palace, Star } from "@/lib/ziwei/types";
import { BRANCHES, STEMS } from "@/lib/ziwei/constants";
import { SiHuaBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/ui/cn";

export interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  /** 保留星曜点击契约（本轮不接星曜详情）。 */
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  /** 叠加四化：星名 → 四化类型（'禄'/'权'/'科'/'忌'） */
  overlayStarSiHua?: Record<string, string>;
  /** 叠加标签：'年'（流年）或 '限'（大限） */
  overlayLabel?: string;
  /** 保留四化点击契约（本轮不接四化钻取）。 */
  onSiHuaClick?: (starName: string, siHua: string) => void;
}

function brightnessTone(brightness?: Star["brightness"]): string {
  if (brightness === "bright") return "text-ink";
  if (brightness === "dim") return "text-ink-3";
  return "text-ink-2";
}

/**
 * 单个宫位：印刷表格质感——细线分隔、无大圆角、无阴影。
 * 整宫是一个 <button>，宫名 + 主星 + 四化写进 aria-label。
 */
export default function PalaceCell({
  palace,
  onClick,
  isSelected = false,
  isSanFang = false,
  overlayStarSiHua,
  overlayLabel,
}: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const ganzhi = `${STEMS[stem] ?? ""}${BRANCHES[branch] ?? ""}`;

  const majorStars = stars.filter((star) => star.type === "major");
  const luckyStars = stars.filter((star) => star.type === "lucky");
  const shaStars = stars.filter((star) => star.type === "sha");

  const ariaParts = [name];
  if (isShenGong) ariaParts.push("身宫在此");
  ariaParts.push(`干支${ganzhi}`);
  if (majorStars.length > 0) {
    ariaParts.push(
      `主星${majorStars
        .map((star) => `${star.name}${star.brightnessRaw ?? ""}${star.siHua ? `化${star.siHua}` : ""}`)
        .join("、")}`,
    );
  } else {
    ariaParts.push("空宫");
  }
  if (isCurrentDaXian && daXianAge) {
    ariaParts.push(`当前大限 ${daXianAge[0]} 至 ${daXianAge[1]} 岁`);
  }
  if (isSelected) ariaParts.push("已选中，显示三方四正");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaParts.join("，")}
      aria-pressed={isSelected}
      data-palace-branch={branch}
      className={cn(
        "relative flex h-full w-full flex-col gap-1 bg-paper p-1.5 text-left transition-colors duration-150 sm:p-2",
        "hover:bg-surface-2/70",
        isSelected
          ? "bg-cinnabar/[0.04] outline outline-1 -outline-offset-1 outline-cinnabar/60"
          : isSanFang
            ? "bg-cinnabar/[0.03] outline outline-1 -outline-offset-1 outline-dashed outline-cinnabar/35"
            : null,
      )}
    >
      {/* 宫名 / 命身标记 / 大限年龄 */}
      <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-1 gap-y-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-1">
          <span
            className={cn(
              "font-serif text-[12px] font-semibold tracking-[0.06em]",
              isMingGong ? "text-cinnabar" : "text-ink-2",
            )}
          >
            {name}
          </span>
          {isShenGong ? (
            <span className="border border-line/25 px-0.5 text-[12px] leading-none text-ink-3">
              身
            </span>
          ) : null}
        </span>
        {daXianAge ? (
          <span
            className={cn(
              "font-mono text-[12px] leading-none tabular-nums",
              isCurrentDaXian ? "font-medium text-cinnabar" : "text-ink-3",
            )}
          >
            {daXianAge[0]}–{daXianAge[1]}
          </span>
        ) : null}
      </span>

      {/* 干支 */}
      <span className="font-mono text-[12px] leading-none tabular-nums text-ink-3">{ganzhi}</span>

      {/* 主星 + 四化 */}
      <span className="flex min-w-0 flex-col gap-0.5">
        {majorStars.length === 0 ? (
          <span className="font-serif text-[12px] leading-snug text-ink-3">空宫</span>
        ) : (
          majorStars.map((star) => {
            const overlaySiHua = overlayStarSiHua?.[star.name];
            return (
              <span key={star.name} className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <span
                  className={cn(
                    "font-serif text-[15px] font-semibold leading-tight",
                    brightnessTone(star.brightness),
                  )}
                >
                  {star.name}
                </span>
                {star.brightnessRaw ? (
                  <span
                    className={cn(
                      "text-[12px] leading-none",
                      star.brightness === "dim" ? "text-ink-3" : "text-ink-2",
                    )}
                  >
                    {star.brightnessRaw}
                  </span>
                ) : null}
                {star.siHua ? <SiHuaBadge siHua={star.siHua} /> : null}
                {overlaySiHua ? (
                  <SiHuaBadge siHua={overlaySiHua} overlay label={overlayLabel} />
                ) : null}
              </span>
            );
          })
        )}
      </span>

      {/* 吉星（辅星）：<640px 隐藏，优先保证宫格紧凑可读 */}
      {luckyStars.length > 0 ? (
        <span className="hidden flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-snug text-ink-3 sm:flex">
          {luckyStars.map((star) => {
            const overlaySiHua = overlayStarSiHua?.[star.name];
            return (
              <span key={star.name} className="inline-flex items-center gap-0.5">
                {star.name}
                {star.siHua ? <SiHuaBadge siHua={star.siHua} /> : null}
                {overlaySiHua ? (
                  <SiHuaBadge siHua={overlaySiHua} overlay label={overlayLabel} />
                ) : null}
              </span>
            );
          })}
        </span>
      ) : null}

      {/* 煞星：<640px 隐藏，优先保证宫格紧凑可读 */}
      {shaStars.length > 0 ? (
        <span className="hidden flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-snug text-ink-2/90 sm:flex">
          {shaStars.map((star) => {
            const overlaySiHua = overlayStarSiHua?.[star.name];
            return (
              <span key={star.name} className="inline-flex items-center gap-0.5">
                {star.name}
                {star.siHua ? <SiHuaBadge siHua={star.siHua} /> : null}
                {overlaySiHua ? (
                  <SiHuaBadge siHua={overlaySiHua} overlay label={overlayLabel} />
                ) : null}
              </span>
            );
          })}
        </span>
      ) : null}
    </button>
  );
}
