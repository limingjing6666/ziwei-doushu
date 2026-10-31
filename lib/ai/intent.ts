/** Question intent only: do not buffer an overview/topic merely because its answer may contain years. */
export const isMarriageQuestion = (s: string) => /婚|感情|对象|恋爱|伴侣|love/.test(s);
export const isHealthQuestion = (s: string) => /健康|身体|体质|疾|病|health/.test(s);
const NUMERIC_INTENT = /大限|大运|多少岁|几岁|年龄|哪几年|哪一年|何时|什么时候|明年|今年|\d{4}\s*年|流年|年份|婚|健康|身体|体质|疾病|health/;
export const isNumericSensitive = (question: string) => NUMERIC_INTENT.test(question);
export const isMarriageTimingQuestion = (s: string) => isMarriageQuestion(s) && /婚期|结婚|何时|什么时候|哪年|哪一年|哪几年|几岁|多少岁|年份/.test(s);
