import Term from './Term';

/** 保留原文与段落版式，只给关键术语增加可点击解释。 */
const TERMS = /(三方四正|生年四化|庙旺利陷|空宫借星|化禄|化权|化科|化忌|命宫|身宫|夫妻宫|疾厄宫|福德宫|大限|流年|四化)/g;
export default function TermText({ text }: { text: string }) {
  return <>{text.split(TERMS).map((part, i) => i % 2 ? <Term key={i} name={part} /> : part)}</>;
}
