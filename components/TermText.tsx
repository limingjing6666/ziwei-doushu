import Term from './Term';

/** One renderer per message, shared by all Markdown text nodes. Never edits text. */
const TERMS = /(三方四正|生年四化|大限四化|流年四化|庙旺利陷|空宫借星|化禄|化权|化科|化忌|命宫|身宫|夫妻宫|疾厄宫|福德宫|大限|流年|四化)/g;
export function createTermRenderer() {
  const counts = new Map<string, number>();
  return (text: string) => {
    const parts = text.split(TERMS);
    return <>{parts.map((part, i) => {
      if (!(i % 2)) return part;
      const count = (counts.get(part) ?? 0) + 1;
      counts.set(part, count);
      return count <= 2 && !/^[（(]/.test(parts[i + 1] ?? '') ? <Term key={i} name={part} /> : part;
    })}</>;
  };
}
export default function TermText({ text }: { text: string }) {
  return createTermRenderer()(text);
}
