import assert from 'node:assert/strict';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from '../../lib/ai/prompts';
import { METHOD_PROMPT } from '../../lib/ziwei/method/framework';
import { readFileSync } from 'node:fs';
import { STAR_DB, TOPIC_LABEL } from '../../lib/ziwei/db-analysis';
import { ALL_STARS, getKnowledge } from '../../lib/seo/knowledge';
import { safeReference, retrieveKnowledge } from '../../lib/ai/knowledge';
import { normalizeChart } from '../../lib/ai/input';

for (const prompt of [INTERPRET_SYSTEM, HEMING_SYSTEM]) {
  assert.match(prompt, /【分层解盘流程】/);
  assert.match(prompt, /按传统断法直接下结论/);
  assert.doesNotMatch(prompt, /但不是医学诊断|缺年份或大限就说明限制|缺项或流派差异须明示|不为追求气势使用绝对断言/);
  assert.match(prompt, /不预测死期/);
  assert.match(prompt, /不复现原句或近似表达/);
}
assert.match(METHOD_PROMPT, /易患疾病类别、器官系统倾向与有依据的健康关键年份/);
assert.match(METHOD_PROMPT, /大限\/流年婚期与分合判断，不编造缺失数据/);

assert.equal(TOPIC_LABEL.health, '健康状况');
for (const star of ALL_STARS) assert.equal(getKnowledge(star, 'health').parsed.raw, STAR_DB[star].jiE);
for (const text of ['星曜推出心脏病。', '脏腑器官与健康隐患，体检就医医疗。', '离婚、必离、夭、残疾。']) {
  assert.equal(safeReference(text), text);
}
for (const text of ['\u502a\u5e08的说法。', '\u502a\u6d77\u53a6讲课。', '天纪内容。', 'B站第5讲。', 'bilibili p05。', '12:34 的讲课。', '第 3 集。', '死别。', '埋尸。', '坟。', '冢。', '重大灾。', '前世欠债。', '刑克。', '克夫。', '克妻。']) {
  assert.equal(safeReference(text), '', text);
}
// Restoring jiE retrieval must not restore restricted quotations: test the actual RAG path.
const original = STAR_DB.紫微.jiE;
try {
  STAR_DB.紫微.jiE = '体质病理与脏腑观察测试段。\n\n\u502a\u5e08说受限内容。\n\nB站第5讲。';
  const chart = normalizeChart({ palaces: [{ name: '疾厄', branch: 0, stars: [{ name: '紫微', type: 'major' }] }] });
  const references = retrieveKnowledge(chart);
  assert.match(references, /体质病理与脏腑观察测试段/);
  assert.doesNotMatch(references, /\u502a\u5e08|B站|受限内容/);
} finally { STAR_DB.紫微.jiE = original; }
const panel = readFileSync('components/InsightPanel.tsx', 'utf8');
assert.match(panel, /\['health', '健康'/);
assert.doesNotMatch(panel, /身心状态|\['rhythm'|不断言婚期|请简要解读/);
assert.match(panel, /容易遇到对象、结婚或感情变动的大限\/流年/);
assert.match(panel, /send\(question, 'overview', true, true\)/);
assert.match(panel, /placeholder="(?:继续追问，如：)?今年适合换工作吗？"/);
assert.match(readFileSync('lib/ai/handler.ts', 'utf8'), /Date\.now\(\) \+ 57000/);
for (const route of ['interpret', 'heming']) assert.match(readFileSync(`app/api/${route}/route.ts`, 'utf8'), /maxDuration = 60/);
console.log('✓ Prompt rules: 首句/术语/无免责收尾、健康婚期策略、恢复篇幅、知识检索及引文过滤、话题路由与时限');
