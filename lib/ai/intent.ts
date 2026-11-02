/** Question intent only: do not buffer an overview/topic merely because its answer may contain years. */
export const isMarriageQuestion = (s: string) => /婚|感情|对象|恋爱|伴侣|love/.test(s);
export const isHealthQuestion = (s: string) => /健康|身体|体质|疾|病|health/.test(s);
