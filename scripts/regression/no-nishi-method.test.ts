import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { GENERATED_STAR_DB } from '../../lib/ziwei/star-db.generated';

const banned = /杀星最集中|最集中那一宫|看全盘杀星|倪师|倪海厦|天纪|倪先生|杀星集中|地支对应脏腑|按杀星所在|哪一宫的地支|地支配脏腑|杀星聚集|午宫对先天的心|戌宫心包|子胆、丑肝/;
assert.doesNotMatch(JSON.stringify(GENERATED_STAR_DB), banned);
// Exact key inventory guards against silently dropping any of the original 50 jiE entries.
const keys = Object.keys(GENERATED_STAR_DB);
assert.equal(keys.length, 50);
for (const key of keys) {
  const text = GENERATED_STAR_DB[key].jiE;
  assert.ok(text, `${key}: jiE must exist`);
  assert.ok(text.trim(), `${key}: jiE must be nonempty`);
  assert.ok(text.includes('【核心论断】'), `${key}: core section missing`);
}
const files = execFileSync('git', ['ls-files', '-z', '--', 'lib'], { encoding: 'utf8' }).split('\0');
for (const file of files) {
  if (!file || /(?:^|\/)(?:experiments|__tests__)(?:\/|$)|\.(?:test|spec)\./.test(file)) continue;
  if (!/\.(?:[cm]?[jt]sx?|json)$/.test(file)) continue;
  assert.doesNotMatch(readFileSync(file, 'utf8'), banned, file);
}
console.log('✓ health-method guard: all 50 jiE entries retained; lib sources clean');
