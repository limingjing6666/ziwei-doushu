'use client';
import type { Star } from '@/lib/ziwei/types';
import { STAR_DESCRIPTIONS } from '@/lib/ziwei/constants';
import { termDescription, GLOSSARY } from '@/lib/glossary';
import Term from './Term';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
export default function StarDetailPanel({ star, palaceName, onClose }: { star: Star | null; palaceName?: string; onClose: () => void }) {
  if (!star) return null;
  const desc = STAR_DESCRIPTIONS[star.name];
  return <Card className="min-w-0 p-4 my-3 text-ink-2" role="region" aria-label="星曜本地简介"><div className="flex items-start justify-between gap-3"><h3 className="break-words font-serif text-lg text-ink">{star.name} · {palaceName}</h3><Button variant="secondary" size="sm" className="shrink-0" onClick={onClose}>收起</Button></div>
    <Badge tone="muted" className="my-2">本地简介，不请求 AI</Badge>
    <div className="flex flex-wrap gap-3 my-3"><Term name={star.type === 'major' ? '主星' : star.type === 'sha' ? '煞星' : '辅星'} />{star.brightnessRaw && <Term name="庙旺利陷">亮度：{star.brightnessRaw}</Term>}{star.siHua && <Term name={`化${star.siHua}`} />}</div>
    <p className="text-sm leading-7">{GLOSSARY[star.name] ? termDescription(star.name) : desc ? `传统关键词：${desc.keywords}。这些是观察倾向，需要结合宫位、亮度与其他星曜，不是对人的定性。` : termDescription(star.name)}</p>
    <a href="/knowledge" className="underline text-sm">了解更多 →</a>
  </Card>;
}
