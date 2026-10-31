import React, { type ReactNode } from 'react';

/** No HTML parser, no clickable links. Unclosed inline markers remain text. */
function inline(text: string): ReactNode[] {
  const tokens = /(\*\*([^*\n]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|`([^`\n]+)`)/g;
  const result: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(tokens)) {
    const index = m.index!;
    result.push(text.slice(last, index));
    result.push(m[2] !== undefined ? <strong key={index}>{m[2]}</strong> : m[3] !== undefined ? <em key={index}>{m[3]}</em> : <code key={index}>{m[4]}</code>);
    last = index + m[0].length;
  }
  result.push(text.slice(last));
  return result;
}
export default function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const heading = lines[i].match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      const tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
      nodes.push(React.createElement(tag, { key: i }, inline(heading[2]))); i++; continue;
    }
    const list = lines[i].match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
    if (list) {
      const ordered = !list[1]; const items: ReactNode[] = []; const start = i;
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
        if (!m || !m[1] !== ordered) break;
        items.push(<li key={i}>{inline(m[2])}</li>); i++;
      }
      nodes.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    if (!lines[i].trim()) { i++; continue; }
    const start = i; const paragraph: ReactNode[] = [];
    while (i < lines.length && lines[i].trim() && (i === start || !/^(#{1,3}\s|\s*(?:[-*]|\d+\.)\s)/.test(lines[i]))) {
      if (i > start) paragraph.push(<br key={`br-${i}`} />);
      paragraph.push(<React.Fragment key={`line-${i}`}>{inline(lines[i])}</React.Fragment>); i++;
    }
    nodes.push(<p key={start}>{paragraph}</p>);
  }
  return <div className="ai-markdown">{nodes}{streaming && <span className="animate-pulse" aria-label="正在生成">▍</span>}</div>;
}
