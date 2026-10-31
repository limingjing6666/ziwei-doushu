"use client";
import type { Palace, Star } from '@/lib/ziwei/types';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { SiHuaBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/ui/cn';
import Term from './Term';

export interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  overlayStarSiHua?: Record<string, string>;
  overlayLabel?: string;
  onSiHuaClick?: (starName: string, siHua: string) => void;
}
/** #9 印刷宫格；交互分为独立按钮，避免 Term 与星曜按钮嵌套。 */
export default function PalaceCell({ palace, onClick, onStarClick, isSelected = false, isSanFang = false, overlayStarSiHua, overlayLabel, onSiHuaClick }: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;
  const majorStars = stars.filter(s => s.type === 'major');
  const renderStar = (star: Star, major: boolean) => {
    const overlay = overlayStarSiHua?.[star.name];
    return <span key={star.name} className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
      <button type="button" onClick={e => { e.stopPropagation(); onStarClick?.(star); }} className={cn('min-h-9 max-w-full break-words font-serif leading-tight', major ? 'text-[15px] font-semibold' : 'text-[12px]', star.brightness === 'bright' ? 'text-ink' : star.brightness === 'dim' ? 'text-ink-3' : 'text-ink-2')}>{star.name}</button>
      {major && star.brightnessRaw && <span className="text-[12px] text-ink-2"><Term name="庙旺利陷">{star.brightnessRaw}</Term></span>}
      {star.siHua && <Term name={`化${star.siHua}`}><SiHuaBadge siHua={star.siHua} /></Term>}
      {overlay && <button type="button" className="min-h-9" aria-label={`${star.name}${overlayLabel}化${overlay}`} onClick={e => { e.stopPropagation(); onSiHuaClick?.(star.name, overlay); }}><SiHuaBadge siHua={overlay} overlay label={overlayLabel} /></button>}
    </span>;
  };
  return <div role="group" aria-label={`${name}，${majorStars.map(s => s.name).join('、') || '空宫'}`} data-palace-branch={branch} onClick={onClick} className={cn('relative flex h-full min-w-0 w-full flex-col gap-1 bg-paper p-1.5 text-left transition-colors sm:p-2 hover:bg-surface-2/70', isSelected ? 'bg-cinnabar/[0.04] outline outline-1 -outline-offset-1 outline-cinnabar/60' : isSanFang ? 'bg-cinnabar/[0.03] outline outline-1 -outline-offset-1 outline-dashed outline-cinnabar/35' : null)}>
    <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-1 gap-y-0.5">
      <span className="flex min-w-0 flex-wrap items-baseline gap-1">
        <button type="button" aria-label={`选择${name}`} aria-pressed={isSelected} onClick={e => { e.stopPropagation(); onClick?.(); }} className={cn('min-h-9 font-serif text-[12px] font-semibold tracking-[0.06em]', isMingGong ? 'text-cinnabar' : 'text-ink-2')}>{name}</button>
        {isShenGong && <span className="border border-line/25 px-0.5 text-[12px] leading-none text-ink-3">身</span>}
      </span>
      {daXianAge && <span className={cn('font-mono text-[12px] leading-none tabular-nums', isCurrentDaXian ? 'font-medium text-cinnabar' : 'text-ink-3')}>{daXianAge[0]}–{daXianAge[1]}</span>}
    </span>
    <span className="flex flex-wrap items-center gap-1 font-mono text-[12px] leading-snug text-ink-3">{STEMS[stem]}{BRANCHES[branch]} <Term name={name}>简介</Term></span>
    <span className="flex min-w-0 flex-col gap-0.5">{majorStars.length ? majorStars.map(s => renderStar(s, true)) : <span className="text-[12px] text-ink-3"><Term name="空宫借星">空宫</Term></span>}</span>
    <span className="hidden min-w-0 flex-wrap gap-x-1.5 text-[12px] text-ink-3 sm:flex">{stars.filter(s => s.type === 'lucky').map(s => renderStar(s, false))}</span>
    <span className="hidden min-w-0 flex-wrap gap-x-1.5 text-[12px] text-ink-2 sm:flex">{stars.filter(s => s.type === 'sha').map(s => renderStar(s, false))}</span>
  </div>;
}
