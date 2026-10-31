import TermText from '@/components/TermText';
import Markdown from '@/components/Markdown';
import { cn } from '@/lib/ui/cn';

/** #8 安全 Markdown 解析 + #9 朱砂标题、宋体引文与正文排版。 */
export function AiProse({ text, streaming = false, className }: { text: string; streaming?: boolean; className?: string }) {
  const normalized = text.replace(/^\*\*【(.+?)】\*\*$/gm, '### $1').replace(/^·\s+/gm, '- ');
  return <div className={cn('ai-prose', className)} aria-busy={streaming || undefined}><Markdown text={normalized} streaming={streaming} renderText={value => <TermText text={value} />} /></div>;
}
