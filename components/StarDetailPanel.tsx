'use client';
import type { Star } from '@/lib/ziwei/types';
import { STAR_DESCRIPTIONS } from '@/lib/ziwei/constants';
import { termDescription, GLOSSARY } from '@/lib/glossary';
import Term from './Term';
export default function StarDetailPanel({ star, palaceName, onClose }: { star: Star | null; palaceName?: string; onClose: () => void }) {
  if (!star) return null;
  const desc = STAR_DESCRIPTIONS[star.name];
  return <section className="card rounded-xl p-4 my-3" aria-label="星曜本地简介"><div className="flex justify-between gap-3"><h3 className="text-lg" style={{ color: 'var(--ac)' }}>{star.name} · {palaceName}</h3><button className="ux-button" onClick={onClose}>收起</button></div>
    <p className="text-xs my-2">本地简介，不请求 AI</p>
    <div className="flex flex-wrap gap-3 my-3"><Term name={star.type === 'major' ? '主星' : star.type === 'sha' ? '煞星' : '辅星'} />{star.brightnessRaw && <Term name="庙旺利陷">亮度：{star.brightnessRaw}</Term>}{star.siHua && <Term name={`化${star.siHua}`} />}</div>
    <p className="text-sm leading-7">{GLOSSARY[star.name] ? termDescription(star.name) : desc ? `传统关键词：${desc.keywords}。这些是观察倾向，需要结合宫位、亮度与其他星曜，不是对人的定性。` : termDescription(star.name)}</p>
    <a href="/knowledge" className="underline text-sm">了解更多 →</a>
  </section>;
}
