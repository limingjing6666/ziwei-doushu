'use client';
import type { Palace, Star } from '@/lib/ziwei/types';
import { STEMS, BRANCHES } from '@/lib/ziwei/constants';
import Term from './Term';
interface Props {
  palace: Palace; onClick?: () => void; onStarClick?: (star: Star) => void;
  isSelected?: boolean; isSanFang?: boolean; delay?: number;
  overlayStarSiHua?: Record<string, string>; overlayLabel?: string;
  onSiHuaClick?: (starName: string, siHua: string) => void;
}
export default function PalaceCell({ palace: p, onClick, onStarClick, isSelected, isSanFang, overlayStarSiHua, overlayLabel, onSiHuaClick }: Props) {
  return <div className={`palace-cell ${isSelected ? 'selected' : ''}`} data-palace={p.name} onClick={onClick} style={{ background: isSelected ? 'var(--ac-bg)' : isSanFang ? 'rgba(58,120,212,.08)' : 'var(--t-bg)' }}>
    <button className="palace-select" onClick={e => { e.stopPropagation(); onClick?.(); }} aria-pressed={!!isSelected} aria-label={`选择${p.name}`}><strong>{p.name}</strong>{p.isShenGong && <span className="text-xs"> · 身</span>}</button>
    <p className="text-xs mb-1" style={{ color: 'var(--tx-2)' }}>{STEMS[p.stem]}{BRANCHES[p.branch]} <Term name={p.name}>简介</Term></p>
    {p.daXianAge && <p className="text-xs" style={{ color: p.isCurrentDaXian ? 'var(--ac)' : 'var(--tx-2)' }}>{p.daXianAge.join('–')}岁</p>}
    {!p.stars.some(s => s.type === 'major') && <p className="text-xs my-2"><Term name="空宫借星">空宫</Term></p>}
    <div className="flex flex-wrap items-start gap-x-2">{p.stars.map(s => <div key={s.name} className={s.type === 'major' ? 'w-full' : ''}>
      <button className={`palace-star ${s.type === 'major' ? 'major-star' : 'minor-star'}`} onClick={e => { e.stopPropagation(); onStarClick?.(s); }} style={{ color: s.type === 'major' ? 'var(--ac)' : 'var(--tx-2)' }}>{s.name}{s.brightnessRaw && s.type === 'major' && <small className="ml-1 font-normal text-[11px]">{s.brightnessRaw}</small>}</button>
      {s.siHua && <span className="text-[11px] ml-1" style={{ color: 'var(--ac)' }}>化{s.siHua}</span>}
      {overlayStarSiHua?.[s.name] && <button className="text-[11px] border border-dashed rounded px-1 min-h-10" onClick={e => { e.stopPropagation(); onSiHuaClick?.(s.name, overlayStarSiHua[s.name]); }}>{overlayLabel}化{overlayStarSiHua[s.name]}</button>}
    </div>)}</div>
  </div>;
}
