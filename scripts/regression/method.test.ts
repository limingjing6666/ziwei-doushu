import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import rules from '../../lib/ziwei/method/rules.json';
import sources from '../../lib/ziwei/method/source-index.json';
import manifest from '../../lib/ziwei/method/extraction-manifest.json';
import { MENTAL_MODELS, METHOD_PROMPT } from '../../lib/ziwei/method/framework';
import { matchesRule, retrieveMethod, RULE_INDEX } from '../../lib/ziwei/method/retrieve';
import { generateChart } from '../../lib/ziwei/algorithm';
import { retrieveKnowledge } from '../../lib/ai/knowledge';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from '../../lib/ai/prompts';
import type { ZiweiChart } from '../../lib/ziwei/types';

assert.equal(rules.length, 30);
assert.ok(MENTAL_MODELS.length >= 3 && MENTAL_MODELS.length <= 7);
const allowed = new Set(['07-methodology', '01-stars', '02-palaces', '03-patterns', '04-sihua']);
const index = sources as Record<string, { book: string; topic_key: string; lecture: string; evidence_hash: string }>;
for (const rule of rules) {
  assert.ok(rule.source_ids.length);
  const evidence = [...new Map(rule.source_ids.map(id => [index[id].evidence_hash, index[id]])).values()];
  assert.ok(evidence.every(e => allowed.has(e.book)));
  const recurring = new Set(evidence.map(e => e.topic_key)).size >= 2 || new Set(evidence.map(e => e.lecture)).size >= 2;
  assert.equal(rule.confidence, recurring ? 'high' : 'low', rule.id);
}
for (const packet of manifest.packets) assert.ok(packet.source_ids.length >= 20 && packet.source_ids.length <= 60);
for (const model of MENTAL_MODELS) assert.ok(model.rules.every(id => rules.some(r => r.id === id)));
assert.ok(INTERPRET_SYSTEM.includes(METHOD_PROMPT));
assert.ok(HEMING_SYSTEM.includes('大限优先'));
assert.ok(RULE_INDEX.star.get('紫微')?.length);
assert.ok(RULE_INDEX.palace.get('夫妻')?.length);
assert.ok(RULE_INDEX.pattern.get('巨日')?.length);
assert.ok(RULE_INDEX.sihua.get('科')?.length);
const a = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
const b = generateChart({ year: 1992, month: 6, day: 15, hour: 5, gender: 'female' });
assert.ok(retrieveMethod(a, '本盘').length <= 1400);
const rag = retrieveKnowledge(a, b);
assert.ok(rag.length <= 6000);
assert.ok(rag.includes('A方法[structure') && rag.includes('B方法[structure'));
assert.ok(rag.includes('方法[decade'));
const r = (id: string) => rules.find(r => r.id === id)!;
const fake = (stars: { name: string; siHua?: '科' | '禄'; brightnessRaw?: '庙' | '陷' }[]) => ({ ...a,
  palaces: a.palaces.map((p, i) => ({ ...p, stars: i === 0 ? stars.map(s => ({ ...s, type: 'major' as const })) : [] })) }) as ZiweiChart;
assert.equal(matchesRule(r('juri'), fake([{ name: '巨门', brightnessRaw: '庙' }, { name: '太阳', brightnessRaw: '陷' }])), false);
assert.equal(matchesRule(r('juri'), fake([{ name: '巨门', brightnessRaw: '庙' }, { name: '太阳', brightnessRaw: '庙' }])), true);
assert.equal(matchesRule(r('ke-lu'), fake([{ name: '文昌', siHua: '科' }])), false);
assert.equal(matchesRule(r('ke-lu'), fake([{ name: '文昌', siHua: '科' }, { name: '武曲', siHua: '禄' }])), true);
assert.equal(matchesRule(r('ziwei-help'), fake([{ name: '紫微' }])), false);
assert.equal(matchesRule(r('ziwei-help'), fake([{ name: '紫微' }, { name: '左辅' }])), true);
// Corpus evidence integrity is checked without embedding its content.
const sourcePath = '/tmp/zw/docs/tianji-ziwei/entries.jsonl';
try {
  const raw = readFileSync(sourcePath, 'utf8');
  assert.equal(createHash('sha256').update(raw).digest('hex'), manifest.source_sha256);
  const entries = raw.trim().split('\n').map(l => JSON.parse(l));
  for (const [id, record] of Object.entries(index)) {
    const entry = entries[Number(id.slice(1)) - 1];
    assert.equal(entry.book, record.book);
    assert.equal(String(entry.part), record.lecture);
    assert.equal(createHash('sha256').update(entry.quote).digest('hex'), record.evidence_hash);
  }
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  console.warn('[method] External source absent; integrity recheck skipped, stored provenance still validated.');
}
console.log('[method] provenance, confidence, conditioned retrieval, prompt integration and bounds passed');
