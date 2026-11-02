/**
 * 四化工具模块 — 年干 / 大限宫干 / 流年干 / 流月干 / 流日干 / 流时干
 *                + 宫干自化检测 + 来因宫追溯
 *
 * 排盘口径（2026-07-21 铁律：排盘以金标准盘为准）：
 *   本命四化 = 出生年天干四化（盘上朱红印章，始终显示）
 *   运限四化 = 大限宫干 / 流年干 / 流月干 / 流日干 / 流时干 → 叠层色章
 * 论断正文按三合结构；本模块供排盘叠层使用。
 */

import type { Palace, SiHua } from './types';
import { SI_HUA_TABLE } from './constants';

// ─── 1) 由天干索引取四化四星 ───────────────────────────────────
/** 天干索引 0-9 → { 禄, 权, 科, 忌 } 对应星名 */
export function getSiHuaByStem(stemIndex: number): Record<SiHua, string> {
  const arr = SI_HUA_TABLE[stemIndex];
  if (!arr) return { 禄: '', 权: '', 科: '', 忌: '' };
  return { 禄: arr[0], 权: arr[1], 科: arr[2], 忌: arr[3] };
}

// ─── 2) 公历年 → 年柱天干索引 ──────────────────────────────────
/** 公历年份 → 年柱天干索引（0=甲, ... 9=癸） */
export function getYearStemIndex(year: number): number {
  return ((year - 4) % 10 + 10) % 10;
}

// ─── 6) 宫干自化检测 ──────────────────────────────────────────
/**
 * 自化：该宫宫干引发的四化，被化星恰在本宫
 * e.g. 宫干为甲（廉破武阳），如果本宫主星含"廉贞"，则该宫有"自化禄"
 */
export interface SelfSihua {
  siHua: SiHua;        // 禄/权/科/忌
  starName: string;    // 被化的星
}

export function detectSelfSihua(palace: Palace): SelfSihua[] {
  const transforms = getSiHuaByStem(palace.stem);
  const found: SelfSihua[] = [];
  const palaceStarNames = new Set(palace.stars.map(s => s.name));
  (['禄', '权', '科', '忌'] as SiHua[]).forEach(sh => {
    const starName = transforms[sh];
    if (starName && palaceStarNames.has(starName)) {
      found.push({ siHua: sh, starName });
    }
  });
  return found;
}
