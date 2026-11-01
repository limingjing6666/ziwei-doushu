import React, { type ReactNode } from 'react';

/** No HTML parser, no clickable links. Unclosed inline markers remain text. */
function inline(text: string, renderText: (text: string) => ReactNode): ReactNode[] {
  const tokens = /(\*\*([^*\n]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|`([^`\n]+)`)/g;
  const result: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(tokens)) {
    const index = m.index!;
    result.push(<React.Fragment key={`text-${index}`}>{renderText(text.slice(last, index))}</React.Fragment>);
    result.push(m[2] !== undefined ? <strong key={index}>{renderText(m[2])}</strong> : m[3] !== undefined ? <em key={index}>{renderText(m[3])}</em> : <code key={index}>{m[4]}</code>);
    last = index + m[0].length;
  }
  result.push(<React.Fragment key="tail">{renderText(text.slice(last))}</React.Fragment>);
  return result;
}
export default function Markdown({ text, streaming, renderText = value => value }: { text: string; streaming?: boolean; renderText?: (text: string) => ReactNode }) {
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
    while (i < lines.length && lines[i].trim() && (i === start || !/^(#{1,3}\s|\s*(?:[-*]|\d+\.)\s)/.test(lines[i]))) {
      if (i > start) paragraph.push(<br key={`br-${i}`} />);
      paragraph.push(<React.Fragment key={`line-${i}`}>{inline(lines[i], renderText)}</React.Fragment>); i++;
    }
    nodes.push(<p key={start}>{paragraph}</p>);
  }
  return <div className="ai-markdown">{nodes}{streaming && <span className="animate-pulse" aria-label="正在生成">▍</span>}</div>;
}
