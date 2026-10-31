import assert from 'node:assert/strict';
import { check, collectFile, fingerprint, loadFingerprints, normalize, scan, sourceTexts } from './guard';

const sample = '甲乙丙丁戊己庚辛壬癸';
const source = fingerprint([sample]);
assert.equal(normalize('甲，乙 \n丙！'), '甲乙丙');
assert.equal(check('甲 乙，丙丁。戊己；庚辛，壬癸', source).continuous, true);
assert.equal(check(sample.repeat(2), source).failed, true);
assert.equal(check(sample.slice(0, 8), source).ratio, 1);
assert.equal(check(sample.slice(0, 7), source).failed, false);
assert.equal(check('开窗看云吹风读书做饭', source).failed, false);
// Exactly 10% is allowed, greater than 10% fails (window count, not unique grams).
const eightOnly = fingerprint([sample.slice(0, 8)]);
assert.equal(check(sample.slice(0, 8) + '风'.repeat(9), eightOnly).ratio, 0.1);
assert.equal(check(sample.slice(0, 8) + '风'.repeat(8), eightOnly).failed, true);
assert.equal(check(sample + '风'.repeat(100), source).failed, true, '10-char rule is independent of ratio');
assert.equal(collectFile('app/page.tsx').some(u => u.text.includes('三合四化')), true);
assert.equal(collectFile('lib/ziwei/method/rules.json').some(u => u.text.includes('背景')), true);
const fallback = loadFingerprints('/tmp/source-not-present-for-ci-regression');
assert.ok(fallback.eight.size > 100000);
const raw = sourceTexts();
if (raw) {
  const all = loadFingerprints();
  // Real-source positive tests do not copy protected strings into the repository.
  for (const text of raw.filter(s => normalize(s).length >= 10).slice(-40)) {
    assert.equal(check(text, all).failed, true);
    assert.equal(check(text, fallback).failed, true);
  }
}
const report = scan();
assert.deepEqual(report.failures.map(f => `${f.path}:${f.line}`), []);
console.log(`[copyright regression] ${report.files} files, ${report.units} units, 0 failures; raw and CI-hash paths verified`);
