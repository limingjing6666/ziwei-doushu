import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '../../lib/ziwei/types';
import generated from '../../lib/ziwei/star-rules.generated.json';
import keys from './fixtures/round11-charts300.json';
import { matchesStarRule, normalizeReferenceText, rulePalaces, ruleReferences, type StoredRule } from '../../lib/ai/star-rules';
import { knowledgeRuleReferences, retrieveKnowledge, safeReference } from '../../lib/ai/knowledge';
import { palaceKey } from '../../lib/ai/chart-to-text';
import { retrieveMethod } from '../../lib/ziwei/method/retrieve';
import buildStats from '../build-star-rules/stats.json';
import { check, collectFile, loadFingerprints } from '../copyright/guard';

// No handler, fetch, credentials, or model invocation: actual local iztro charts only.
function chart(key: string): ZiweiChart {
  const [year, month, day, hour, gender] = key.split('-');
  return generateChart({ year: +year, month: +month, day: +day, hour: +hour, gender: gender as BirthInfo['gender'], birthTimeKnown: true });
}
const fixtures = ['2008-01-17-9-male', '1965-08-26-10-male', '1964-08-27-8-male'].map(chart);
const storedRules = generated.rules as StoredRule[];
const index = generated.index as Record<string, number[]>;
const joined = (refs: ReturnType<typeof ruleReferences>) => refs.map(r => r.reference).join('\n\n');
const forbidden = /血光|见血|刑伤|刑克|克父母|克夫|克妻|官非|官司|牢狱|夭|早逝|死|癌|重病|灾|孤独终老|一生|一辈子|必然|必定|必有|必是|一定|注定|离婚|稳赚|凶格|凶象|暴富|暴亏|大坎|意外打断|火烧|被骗|孤君|命运|暴起暴落|七秒决策法|断这类盘|传统断法|倪|天纪|★校勘|待核|本平台|数据集|检索|你这盘|本盘|疾病|健康|病|器官|脏腑|眼疾|眼睛|痔|肾|肝|血压|心脏|心血|胃|肠|肺|鼻炎|内分泌|月经|妇科|皮肤|过敏|失眠|睡眠|神经|免疫|血液|下腹|脾|胆/;
assert.match(generated.meta.source, /v4\.0/);
assert.equal(generated.meta.author, '王多鱼AI');
assert.equal(generated.meta.license, 'CC BY 4.0');
assert.match(generated.meta.modified, /抽取.*过滤.*改写.*去重/);
assert.equal(generated.meta.sihuaSource, 'natal-star.siHua');
assert.equal(generated.meta.version, 2);
assert.match(generated.meta.relation, /bpair:opposite-major\+resident-support/);
assert.ok(buildStats.dropped_occurrences.weak_excluded > 0);
for (const excluded of buildStats.weak_excluded) assert.ok(!generated.texts.includes(excluded.sentence));
assert.ok(statSync('lib/ziwei/star-rules.generated.json').size < 150 * 1024);
assert.ok(generated.texts.join('').length < 15000);
assert.equal(new Set(generated.texts).size, generated.texts.length);
for (const text of generated.texts) {
  assert.doesNotMatch(text, forbidden);
  assert.doesNotMatch(text, /做决定能拖一年是一年|音乐、舞蹈、写作、绘画类艺术工作最自然/);
  assert.ok(text.length >= 8 && text.length <= 150);
  assert.equal(safeReference(text), text);
}
// The default guard now scans untracked artifacts too; explicitly check every JSON
// string using the SAME ten-character and eight-window fingerprint logic as CI.
const fingerprints = loadFingerprints();
for (const unit of collectFile('lib/ziwei/star-rules.generated.json')) assert.equal(check(unit.text, fingerprints).failed, false);
const guardSource = readFileSync('scripts/copyright/guard.ts', 'utf8');
assert.ok(guardSource.includes("'--others'"));
const noMethod = readFileSync('scripts/regression/no-nishi-method.test.ts', 'utf8');
assert.ok(noMethod.includes('JSON.stringify(STAR_RULES), banned'));

for (const c of fixtures) {
  const before = JSON.stringify(c), refs = ruleReferences(c);
  assert.equal(refs.length, c.birthInfo.year === 1965 ? 6 : 5, 'audited fixtures stay sparse rather than restoring excluded weak text');
  for (const name of ['命宫', '夫妻', '官禄', '财帛']) assert.ok(refs.filter(r => r.palace === name).length <= 2);
  if (c.birthInfo.year === 1964) {
    assert.deepEqual(refs.map(r => [r.palace, r.kind]), [['命宫', 'aux'], ['夫妻', 'pair'], ['官禄', 'aux'], ['夫妻', 'pair'], ['官禄', 'bpair']]);
    assert.ok(refs.some(r => /借对宫天机参照；本宫实坐右弼/.test(r.reference)), 'empty overview palaces use exact borrowed/resident stars, not unrelated padding');
  }
  assert.ok(joined(refs).length <= 800);
  assert.deepEqual(refs, ruleReferences(c));
  assert.equal(new Set(refs.map(r => normalizeReferenceText(r.text))).size, refs.length);
  assert.equal(JSON.stringify(c), before, 'references never change chart facts');
  const unknown = structuredClone(c); unknown.birthInfo.birthTimeKnown = false;
  assert.deepEqual(ruleReferences(unknown), []);
  assert.equal(retrieveKnowledge(unknown).trim(), '');
  assert.equal(ruleReferences(c, { maxItems: 0 }).length, 0);
  assert.equal(ruleReferences(c, { maxChars: 0 }).length, 0);
  assert.ok(joined(ruleReferences(c, { maxItems: 3, maxChars: 150 })).length <= 150);
  const topic = ruleReferences(c, { question: '今年适合换工作吗？' });
  assert.ok(topic.every(r => ['官禄', '命宫'].includes(r.palace)));
  assert.ok(topic.filter(r => r.palace === '命宫').length <= 1);
  for (const b of [undefined, fixtures[1]]) {
    const rules = knowledgeRuleReferences(c, b, '事业');
    assert.ok(rules.length <= 6 && joined(rules).length <= 800);
    const knowledge = retrieveKnowledge(c, b, '事业');
    const method = [retrieveMethod(c, b ? 'A' : '本盘', b ? 1000 : 1400), b ? retrieveMethod(b, 'B', 1000) : ''].filter(Boolean).join('\n');
    assert.ok(knowledge.startsWith(method), 'method reservation unchanged');
    assert.ok(knowledge.length <= 6000);
    for (const rule of rules) assert.ok(knowledge.includes(rule.reference), 'whole new references survive legacy budgeting');
    assert.equal(knowledge, retrieveKnowledge(c, b, '事业'));
  }
}
for (const [i, question, expected] of [
  [0, '我的命宫是不是两颗主星都庙旺？这对学习和工作方式有什么参考？', 1],
  [1, '命宫生年太阴化忌是不是一定会生重病？压力大时，我该怎样安排生活？', 6],
  [2, '我今年适合换工作还是先做副业？命宫空宫，是不是就算天同太阴坐命？', 3],
] as const) assert.equal(knowledgeRuleReferences(fixtures[i], undefined, question).length, expected, 'reproduce previous A/B/C questions locally');
const paired = knowledgeRuleReferences(fixtures[0], fixtures[2]);
assert.ok(paired.some(r => r.reference.startsWith('A')) && paired.some(r => r.reference.startsWith('B')));
assert.ok(joined(paired).length <= 800 && paired.length <= 6);
assert.ok(knowledgeRuleReferences(fixtures[0], { ...fixtures[1], birthInfo: { ...fixtures[1].birthInfo, birthTimeKnown: false } }).every(r => r.reference.startsWith('A')));

const empty = fixtures[2].palaces.find(p => palaceKey(p.name) === '命宫')!;
assert.equal(empty.stars.filter(s => s.type === 'major').length, 0);
assert.ok(empty.borrowedStars?.length);
const opposite = fixtures[2].palaces.find(p => p.branch === empty.oppositeBranch)!;
assert.equal(opposite.branch, (empty.branch + 6) % 12, 'engine oppositeBranch is the branch opposite, not a palace-array offset');
for (const key of Object.keys(index).filter(k => k.split('|')[1] === '命宫' && /^(pair|sihua)\|/.test(k))) {
  for (const id of index[key]) assert.equal(matchesStarRule(empty, key, storedRules[id], opposite), false);
}
assert.ok(ruleReferences(fixtures[2]).some(r => r.palace === '命宫' && r.kind === 'aux' && /本宫实坐文曲/.test(r.reference)));
assert.equal(matchesStarRule(empty, 'aux|命宫|文曲||', [0, [], []]), true);
assert.equal(matchesStarRule(empty, 'sihua|命宫|文曲||科', [0, [], []], opposite), false, 'empty-palace sihua remains disabled');

const borrowedKey = 'bpair|命宫|天同|文曲|';
const borrowedRule: StoredRule = [0, [['天同', '落陷', ['陷']], ['文曲', '得地', ['得']]], []];
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, opposite), true);
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule), false);
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, { ...opposite, branch: empty.branch }), false);
assert.equal(matchesStarRule({ ...empty, stars: [] }, borrowedKey, borrowedRule, opposite), false, 'support must be resident, not borrowed');
assert.equal(matchesStarRule({ ...empty, stars: [...empty.stars, { name: '天同', type: 'major' }] }, borrowedKey, borrowedRule, opposite), false);
const wrongBorrow = structuredClone(opposite);
wrongBorrow.stars = wrongBorrow.stars.filter(s => s.name !== '天同');
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, wrongBorrow), false);
const wrongBrightness = structuredClone(opposite);
wrongBrightness.stars.find(s => s.name === '天同')!.brightnessRaw = '旺';
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, wrongBrightness), false, 'borrowed brightness comes from the opposite star');
const wrongSupport = structuredClone(empty);
wrongSupport.stars.find(s => s.name === '文曲')!.brightnessRaw = '陷';
assert.equal(matchesStarRule(wrongSupport, borrowedKey, borrowedRule, opposite), false, 'support brightness comes from the resident star');
const noBorrowBrightness = structuredClone(opposite), borrowStar = noBorrowBrightness.stars.find(s => s.name === '天同')!;
delete borrowStar.brightnessRaw; borrowStar.brightness = 'dim';
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, noBorrowBrightness), false, 'coarse dim is not equivalent to 陷');
delete borrowStar.brightness;
assert.equal(matchesStarRule(empty, borrowedKey, borrowedRule, noBorrowBrightness), false);

// Exercise borrowed retrieval, not just its predicate; a missing exact key is never filled.
const oldBorrowedIds = index[borrowedKey], borrowedId = storedRules.length, borrowedTextId = generated.texts.length;
const borrowChart = structuredClone(fixtures[2]);
borrowChart.palaces = [structuredClone(empty), { ...structuredClone(opposite), stars: [structuredClone(opposite.stars.find(s => s.name === '天同')!)] }];
// Deliberately stale convenience names must not override the opposite palace's actual stars.
borrowChart.palaces[0].borrowedStars = ['紫微'];
delete index[borrowedKey];
assert.ok(ruleReferences(borrowChart).every(r => r.kind !== 'bpair'));
generated.texts.push('天同 + 文曲，可以通过交流积累经验。');
storedRules.push([borrowedTextId, borrowedRule[1], []]); index[borrowedKey] = [borrowedId];
try {
  const refs = ruleReferences(borrowChart), borrowed = refs.find(r => r.id === borrowedId)!;
  assert.ok(borrowed);
  assert.match(borrowed.reference, /空宫，借对宫天同参照；本宫实坐文曲/);
  assert.doesNotMatch(borrowed.text, /坐|同宫|入命|本宫/);
  assert.ok(ruleReferences(borrowChart, { maxChars: borrowed.reference.length - 1 }).every(r => r.id !== borrowedId), 'budget includes the full borrowed label');
  assert.ok(joined(ruleReferences(borrowChart, { label: '本盘'.repeat(150) })).length <= 800);
  assert.ok(refs.every(r => r.kind === 'aux' || r.kind === 'bpair'));
  borrowChart.palaces[1].stars[0].brightnessRaw = '旺';
  assert.ok(ruleReferences(borrowChart).every(r => r.id !== borrowedId));
} finally {
  generated.texts.pop(); storedRules.pop();
  if (oldBorrowedIds) index[borrowedKey] = oldBorrowedIds; else delete index[borrowedKey];
}
for (const key of Object.keys(index).filter(k => k.startsWith('bpair|'))) for (const id of index[key]) {
  assert.doesNotMatch(generated.texts[storedRules[id][0]], /坐|同宫|入命|入宫|本宫|你的[^，。；：]{0,5}宫/);
}

// A precise absent key is a miss, even if a nearby star/palace has usable text.
const missing = structuredClone(fixtures[0]);
for (const p of missing.palaces) p.stars = [{ name: '不存在的主星', type: 'major' }, { name: '不存在的辅星', type: 'lucky', siHua: '禄' }];
assert.deepEqual(ruleReferences(missing), []);

// Default brightness conflict: this fixture's natal 天机 is 利, NOT 庙/旺.
const ming = fixtures[0].palaces.find(p => palaceKey(p.name) === '命宫')!;
assert.equal(ming.stars.find(s => s.name === '天机')!.brightnessRaw, '利');
const brightnessRule: StoredRule = [0, [['天机', '庙旺', ['庙', '旺']]], []];
const pairKey = 'pair|命宫|天机|文昌|';
const palace = structuredClone(ming); palace.stars.push({ name: '文昌', type: 'lucky' });
assert.equal(matchesStarRule(palace, pairKey, brightnessRule), false);
const bright = structuredClone(palace); bright.stars.find(s => s.name === '天机')!.brightnessRaw = '旺';
assert.equal(matchesStarRule(bright, pairKey, brightnessRule), true);
const unknownBrightness = structuredClone(palace);
const s = unknownBrightness.stars.find(s => s.name === '天机')!;
delete s.brightnessRaw; delete s.brightness;
assert.equal(matchesStarRule(unknownBrightness, pairKey, brightnessRule), false);
s.brightness = 'bright';
assert.equal(matchesStarRule(unknownBrightness, pairKey, brightnessRule), true);
assert.equal(matchesStarRule(unknownBrightness, pairKey, [0, [['天机', '入庙', ['庙']]], []]), false);
s.brightnessRaw = '利'; // raw overrides even a conflicting coarse field
assert.equal(matchesStarRule(unknownBrightness, pairKey, brightnessRule), false);

// Exercise the actual retrieval path with a synthetic opposite-brightness entry;
// mutate only the in-memory fixture tables and restore them, never the JSON file.
const priorIds = index[pairKey], testId = storedRules.length, textId = generated.texts.length;
generated.texts.push('天机庙旺，思考方式灵活，可以安排学习计划。');
storedRules.push([textId, brightnessRule[1], []]); index[pairKey] = [testId];
try {
  const conflict = structuredClone(fixtures[0]);
  conflict.palaces = [{ ...palace, stars: [structuredClone(palace.stars.find(s => s.name === '天机')!), { name: '文昌', type: 'lucky' }] }];
  assert.ok(ruleReferences(conflict).every(r => r.id !== testId));
  conflict.palaces[0].stars[0].brightnessRaw = '旺';
  assert.ok(ruleReferences(conflict).some(r => r.id === testId));
} finally {
  generated.texts.pop(); storedRules.pop();
  if (priorIds) index[pairKey] = priorIds; else delete index[pairKey];
}

const noNatal = structuredClone(fixtures[1]);
for (const p of noNatal.palaces) for (const s of p.stars) delete s.siHua;
noNatal.daXians[0].siHua = { stemIndex: 0, stemName: '甲', lu: '太阴', quan: '天机', ke: '文昌', ji: '太阴' };
Object.assign(noNatal, { yearlySiHua: { lu: '太阴', ji: '太阴' } });
assert.ok(noNatal.daXians.some(d => d.siHua));
assert.ok(ruleReferences(noNatal).every(r => r.kind !== 'sihua'));
const missingHuaKey = 'sihua|命宫|文昌||科';
assert.equal(index[missingHuaKey], undefined);
const missingHua = structuredClone(noNatal);
missingHua.palaces = [{ ...missingHua.palaces.find(p => palaceKey(p.name) === '命宫')!, stars: [{ name: '太阴', type: 'major' }, { name: '文昌', type: 'lucky', siHua: '科' }] }];
assert.ok(ruleReferences(missingHua).every(r => r.kind !== 'sihua'), 'missing natal mark key must not borrow another star or palace text');
const huaKey = 'sihua|命宫|太阴||忌';
const yin = fixtures[1].palaces.find(p => palaceKey(p.name) === '命宫')!;
assert.equal(yin.stars.find(s => s.name === '太阴')!.siHua, '忌');
assert.equal(matchesStarRule(yin, huaKey, [0, [], []]), true);
const moved = structuredClone(yin); moved.stars = moved.stars.filter(s => s.name !== '太阴');
assert.equal(matchesStarRule(moved, huaKey, [0, [], []]), false);
const notNatal = structuredClone(yin); notNatal.stars.find(s => s.name === '太阴')!.siHua = undefined;
notNatal.selfSihua = [{ starName: '太阴', siHua: '忌' }];
assert.equal(matchesStarRule(notNatal, huaKey, [0, [], []]), false);

for (const [question, expected] of [['感情婚姻', '夫妻'], ['事业工作', '官禄'], ['财运', '财帛'], ['迁移出行', '迁移'], ['福德心态', '福德'], ['田宅房子', '田宅'], ['父母', '父母'], ['子女', '子女'], ['兄弟', '兄弟'], ['交友人际', '仆役']]) assert.ok(rulePalaces({ question }).palaces.includes(expected));

assert.equal(keys.length, 300);
const distribution: Record<number, number> = {};
let items = 0, chars = 0, actualPalaceChecks = 0, borrowedChecks = 0, emptyAuxChecks = 0;
for (const key of keys) {
  const c = chart(key), refs = ruleReferences(c);
  assert.deepEqual(refs, ruleReferences(c));
  assert.ok(refs.length <= 6 && joined(refs).length <= 800);
  distribution[refs.length] = (distribution[refs.length] ?? 0) + 1;
  items += refs.length; chars += joined(refs).length;
  for (const r of refs) {
    const p = c.palaces.find(p => palaceKey(p.name) === r.palace)!;
    const opp = c.palaces.find(q => q.branch === p.oppositeBranch);
    if (r.kind === 'bpair') {
      assert.ok(!p.stars.some(s => s.type === 'major'));
      assert.equal(opp?.branch, (p.branch + 6) % 12);
      assert.ok(opp?.stars.some(s => s.name === r.star && s.type === 'major'));
      assert.ok(p.stars.some(s => s.name === r.other && s.type !== 'major'));
      assert.match(r.reference, /借对宫/);
      assert.doesNotMatch(r.text, /坐|同宫|入命|本宫/);
      borrowedChecks++;
    } else {
      assert.ok(p.stars.some(s => s.name === r.star));
      if (r.kind === 'aux') {
        assert.match(r.reference, /本宫实坐/);
        if (!p.stars.some(s => s.type === 'major')) emptyAuxChecks++;
      } else assert.ok(p.stars.some(s => s.type === 'major'));
    }
    if (r.other) assert.ok(p.stars.some(s => s.name === r.other && s.type !== 'major'));
    if (r.kind === 'pair') assert.ok(p.stars.some(s => s.name === r.star && s.type === 'major'));
    if (r.mark) assert.ok(p.stars.some(s => s.name === r.star && s.siHua === r.mark));
    assert.ok(index[r.key].includes(r.id));
    assert.equal(generated.texts[storedRules[r.id][0]], r.text);
    assert.equal(matchesStarRule(p, r.key, storedRules[r.id], opp), true);
    actualPalaceChecks++;
  }
}
assert.ok(borrowedChecks > 0 && emptyAuxChecks > 0);
console.log('Round11b 300-chart metrics:', JSON.stringify({ charts: keys.length, averageItems: items / keys.length, distribution, zeroRate: (distribution[0] ?? 0) / keys.length, averageChars: chars / keys.length, actualPalaceChecks, borrowedChecks, emptyAuxChecks }));
console.log('✓ Round11b: exact resident/borrowed keys, natal marks, brightness gates, shared budgets, deterministic output, attribution and copyright fingerprints');
