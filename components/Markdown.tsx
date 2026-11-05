import React, { type ReactNode } from 'react';

const tokens = /(\*\*([^*\n]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|`([^`\n]+)`)/g;

/** No HTML parser, no clickable links. Unclosed inline markers remain text. */
function inline(text: string, renderText: (text: string) => ReactNode, highlightUntil = 0): ReactNode[] {
  const renderPart = (value: string, start: number, render = renderText) => {
    const count = Math.max(0, Math.min(value.length, highlightUntil - start));
    return count ? <><strong className="text-[17px] font-semibold leading-relaxed">{render(value.slice(0, count))}</strong>{render(value.slice(count))}</> : render(value);
  };
  const result: ReactNode[] = [];
  let last = 0;
  let position = 0;
  for (const m of text.matchAll(tokens)) {
    const index = m.index!;
    const before = text.slice(last, index);
    result.push(<React.Fragment key={`text-${index}`}>{renderPart(before, position)}</React.Fragment>);
    position += before.length;
    result.push(m[2] !== undefined ? <strong key={index}>{renderPart(m[2], position)}</strong> : m[3] !== undefined ? <em key={index}>{renderPart(m[3], position)}</em> : <code key={index}>{renderPart(m[4], position, value => value)}</code>);
    position += (m[2] ?? m[3] ?? m[4]).length;
    last = index + m[0].length;
  }
  result.push(<React.Fragment key="tail">{renderPart(text.slice(last), position)}</React.Fragment>);
  return result;
}
export default function Markdown({ text, streaming, renderText = value => value, highlightFirstSentence = false }: { text: string; streaming?: boolean; renderText?: (text: string) => ReactNode; highlightFirstSentence?: boolean }) {
  // Rendering-only recovery: explicit bold boundaries are unambiguous; for
  // hash headings use a separator or a short title followed by a prose opener.
  const lines = text.replace(/\r\n?/g, '\n').split('\n').flatMap(line => {
    const bold = line.match(/^\*\*(【[^】\n]+】|[^*。！？\n]{1,24})\*\*(.*)$/);
    if (bold) return [`### ${bold[1]}`, ...(bold[2].trim() ? [bold[2].trimStart()] : [])];
    const hash = line.match(/^(#{1,3})\s*(.+)$/);
    if (!hash) return [line];
    const glued = hash[2].match(/^(.{2,20}?)(?:[：:]\s*|\s+(?=\S)|(?=正文|你|双方|两人|甲方|乙方|这段|这个|当前|今年|从命盘|在相处))(.+)$/);
    return glued ? [`${hash[1]} ${glued[1]}`, glued[2]] : [`${hash[1]} ${hash[2]}`];
  });
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const heading = lines[i].match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
      nodes.push(React.createElement(tag, { key: i }, inline(heading[2], renderText))); i++; continue;
    }
    const list = lines[i].match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
    if (list) {
      const ordered = !list[1]; const items: ReactNode[] = []; const start = i;
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
        if (!m || !m[1] !== ordered) break;
        items.push(<li key={i}>{inline(m[2], renderText)}</li>); i++;
      }
      nodes.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    if (!lines[i].trim()) { i++; continue; }
    const start = i; const paragraph: ReactNode[] = [];
    let highlightUntil = 0;
    if (highlightFirstSentence && nodes.length === 0) {
      let end = start;
      while (end < lines.length && lines[end].trim() && !/^\s*(?:#{1,6}\s|(?:[-*+]|\d+[.)])\s)/.test(lines[end])) end++;
      const opening = lines.slice(start, end).join('\n').replace(tokens, '$2$3$4');
      const sentenceEnd = opening.indexOf('。') + 1;
      if (sentenceEnd) highlightUntil = sentenceEnd + opening.slice(sentenceEnd).match(/^[”’」』"']*/)![0].length;
    }
    while (i < lines.length && lines[i].trim() && (i === start || !/^(#{1,3}\s|\s*(?:[-*]|\d+\.)\s)/.test(lines[i]))) {
      if (i > start) paragraph.push(<br key={`br-${i}`} />);
      paragraph.push(<React.Fragment key={`line-${i}`}>{inline(lines[i], renderText, highlightUntil)}</React.Fragment>);
      highlightUntil = Math.max(0, highlightUntil - lines[i].replace(tokens, '$2$3$4').length - 1); i++;
    }
    nodes.push(<p key={start}>{paragraph}</p>);
  }
  return <div className="ai-markdown">{nodes}{streaming && <span className="animate-pulse" aria-label="正在生成">▍</span>}</div>;
}
