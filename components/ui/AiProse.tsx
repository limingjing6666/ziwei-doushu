import { createTermRenderer } from '@/components/TermText';
import Markdown from '@/components/Markdown';
import { cn } from '@/lib/ui/cn';

/** #8 安全 Markdown 解析 + #9 朱砂标题、宋体引文与正文排版。 */
export function AiProse({ text, streaming = false, className }: { text: string; streaming?: boolean; className?: string }) {
  const renderText = createTermRenderer();
  return <div className={cn('ai-prose', className)} aria-busy={streaming || undefined}><Markdown text={text} streaming={streaming} renderText={renderText} /></div>;
}
