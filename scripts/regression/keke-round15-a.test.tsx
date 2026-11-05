import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthForm from '../../components/birth/BirthForm';
import BirthPage from '../../components/birth/BirthPage';
import PrivacyPage from '../../app/privacy/page';
import { validateBirthForm } from '../../lib/birth-form';
import { formToBirthInfo } from '../../lib/ziwei/share';
import type { BirthFormState } from '../../components/BirthForm';

const form: BirthFormState = { name: '', year: '1990', month: '5', day: '15', clockHour: '7', clockMinute: '20', unknownTime: false, province: '河南省', city: '', longitude: 120, gender: 'female' };
const cityError = '你已选择省份，请再选择出生城市';
assert.equal(validateBirthForm(form).city, cityError);
assert.throws(() => formToBirthInfo(form), /请检查出生信息/);
assert.deepEqual(validateBirthForm({ ...form, province: '' }), {});
assert.equal(formToBirthInfo({ ...form, province: '' }).hour, 4);
assert.deepEqual(validateBirthForm({ ...form, city: '郑州', longitude: 113.6 }), {});
assert.equal(formToBirthInfo({ ...form, city: '郑州', longitude: 113.6 }).hour, 3);
for (const variant of ['full', 'compact'] as const) {
  const html = renderToStaticMarkup(<BirthForm variant={variant} initialData={form} onSubmit={() => { throw new Error('must not submit'); }} />);
  assert.ok(html.includes(cityError));
  assert.match(html, /请补齐必填信息/);
  assert.doesNotMatch(html, /信息已齐全|120\.0°E/);
  assert.match(html, /aria-invalid="true"[^>]*aria-describedby="[^"]+-city-error"/);
  assert.match(html, /type="submit"[^>]*disabled=""/);
}
assert.match(renderToStaticMarkup(<BirthPage onStart={() => {}} />), /可以不填出生地，这时按北京时间对应时辰排盘，不作地点校正。如果选了省份，请把城市也选完整。/);
const privacy = renderToStaticMarkup(<PrivacyPage />);
assert.match(privacy, /结果页在本机没有已保存的整盘解读时会自动请求 AI/);
assert.doesNotMatch(privacy, /只有明确点击/);
console.log('✓ Round15 A: 排盘和合盘共用城市校验、红字/状态/禁用、可选地点、隐私说明');
