import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

/**
 * AI 解读文本渲染（轻量 markdown）：
 * - `**【标题】**` → 章节标题
 * - `**加粗**` → strong
 * - `- ` / `· ` 开头 → 列表项
 * - `> ` 开头 → 引文
 * 不引入 markdown 依赖，避免体积与 XSS 风险。
 */
export function AiProse({
  text,
  streaming = false,
  className,
}: {
  text: string;
  streaming?: boolean;
  className?: string;
}) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    if (!line.trim()) return;

    const section = line.match(/^\*\*【(.+?)】\*\*$/);
    if (section) {
      blocks.push(
        <h3
          key={`h-${index}`}
          className="mt-6 border-l-2 border-cinnabar/50 pl-2.5 font-serif text-[16px] font-semibold tracking-[0.02em] text-ink first:mt-0"
        >
          {section[1]}
        </h3>,
      );
      return;
    }

    if (/^>\s?/.test(line)) {
      blocks.push(
        <blockquote
          key={`q-${index}`}
          className="border-l-2 border-ochre/50 pl-3 font-serif text-[15px] leading-[1.9] text-ink-2"
        >
          {renderInline(line.replace(/^>\s?/, ""), index)}
        </blockquote>,
      );
      return;
    }

    if (/^[-·]\s+/.test(line)) {
      blocks.push(
        <p
          key={`li-${index}`}
          className="relative pl-4 text-[15px] leading-[1.85] text-ink-2 before:absolute before:left-0 before:top-[0.78em] before:h-1 before:w-1 before:rounded-full before:bg-cinnabar/60"
        >
          {renderInline(line.replace(/^[-·]\s+/, ""), index)}
        </p>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${index}`} className="text-[15px] leading-[1.85] text-ink-2">
        {renderInline(line, index)}
      </p>,
    );
  });

  return (
    <div className={cn("space-y-2.5", className)} aria-busy={streaming || undefined}>
      {blocks}
      {streaming ? (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-[7px] animate-pulse-soft rounded-xs bg-cinnabar/60 align-text-bottom"
        />
      ) : null}
    </div>
  );
}

function renderInline(line: string, lineIndex: number): ReactNode[] {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${lineIndex}-${index}`} className="font-semibold text-ink">
        {part}
      </strong>
    ) : (
      <span key={`${lineIndex}-${index}`}>{part}</span>
    ),
  );
}
