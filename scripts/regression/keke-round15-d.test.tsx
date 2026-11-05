import React from 'react';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthForm from '../../components/birth/BirthForm';
import ChartMetaBar from '../../components/chart/ChartMetaBar';
import Markdown from '../../components/Markdown';
import { AiProse } from '../../components/ui/AiProse';
import { validateBirthForm } from '../../lib/birth-form';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthFormState } from '../../components/BirthForm';

const form: BirthFormState = { name: '名'.repeat(20), year: '1990', month: '5', day: '15', clockHour: '7', clockMinute: '20', unknownTime: false, province: '河南省', city: '郑州', longitude: 113.6, gender: 'female' };
assert.deepEqual(validateBirthForm(form), {});
assert.equal(validateBirthForm({ ...form, name: '名'.repeat(21) }).name, '姓名最多20个字，请缩短后再试');
assert.throws(() => formToBirthInfo({ ...form, name: '名'.repeat(21) }));
for (const variant of ['full', 'compact'] as const) {
  const html = renderToStaticMarkup(<BirthForm variant={variant} initialData={{ ...form, name: '名'.repeat(21) }} onSubmit={() => {}} />);
  assert.match(html, /maxLength="20"/);
  assert.match(html, /选填，最多20个字/);
  assert.match(html, /姓名最多20个字，请缩短后再试/);
  assert.match(html, /你填写的出生日期处在夏令时期间。如果填的是当时钟表上拨快后的时间，可以减1小时；如果已经减过，就不要再减。不确定时，请先核对出生记录。/);
  assert.match(html, /按夏令时减1小时/);
  assert.doesNotMatch(html, /该时段中国实行过|这是夏令时读数/);
}
assert.doesNotMatch(renderToStaticMarkup(<BirthForm initialData={{ ...form, month: '1' }} onSubmit={() => {}} />), /按夏令时减1小时/);
assert.match(renderToStaticMarkup(<BirthForm initialData={{ ...form, clockHour: '0' }} onSubmit={() => {}} />), /如果减1小时会变成前一天，请先核对出生日期，再手动修改日期和时间。/);
const chart = generateChart(formToBirthInfo(form));
const title = renderToStaticMarkup(<ChartMetaBar chart={{ ...chart, birthInfo: { ...chart.birthInfo, name: 'N'.repeat(100) } }} onReset={() => {}} />);
assert.ok(title.includes(`${'N'.repeat(20)}… · 紫微斗数命盘`));
assert.ok(!title.includes('N'.repeat(21)));
const conclusion = '你走的是靠口碑和服务慢慢攒钱的财运。后面是具体依据。';
const highlighted = renderToStaticMarkup(<Markdown text={conclusion} highlightFirstSentence />);
assert.match(highlighted, /<strong class="text-\[17px\] font-semibold leading-relaxed">你走的是靠口碑和服务慢慢攒钱的财运。<\/strong>后面是具体依据。/);
const strip = (html: string) => html.replace(/<[^>]*>/g, '');
for (const text of [conclusion, '**你走的是靠口碑和服务慢慢攒钱的财运。**后面是具体依据。', '**第一句。第二句。**', '第一句\n到这里结束。下一句。', '首句含`代码`和*重点*。后续。', '**“句末带引号。**”后续。']) {
  assert.equal(strip(renderToStaticMarkup(<Markdown text={text} highlightFirstSentence />)), strip(renderToStaticMarkup(<Markdown text={text} />)));
}
for (const firstSentence of ['“句末带引号。”', '“第一句。”', '「第一句。」', '‘第一句。’', '『第一句。』', '"第一句。"', "'第一句。'", '“「第一句。」”']) {
  const text = `${firstSentence}后续。`;
  const html = renderToStaticMarkup(<Markdown text={text} highlightFirstSentence />);
  assert.ok(html.includes(renderToStaticMarkup(<strong className="text-[17px] font-semibold leading-relaxed">{firstSentence}</strong>)));
  assert.equal(strip(html), strip(renderToStaticMarkup(<Markdown text={text} />)));
}
const boldQuote = renderToStaticMarkup(<Markdown text={'**“句末带引号。**”后续。'} highlightFirstSentence />);
assert.match(boldQuote, /<strong><strong class="text-\[17px\] font-semibold leading-relaxed">“句末带引号。<\/strong><\/strong><strong class="text-\[17px\] font-semibold leading-relaxed">”<\/strong>后续。/);
for (const text of ['没有中文句号', '## 标题\n正文。', '**短标题**\n正文。', '- 列表。', '* 列表。', '1. 列表。', '+ 列表。', '第一段无句号\n\n第二段。']) {
  assert.doesNotMatch(renderToStaticMarkup(<Markdown text={text} highlightFirstSentence />), /text-\[17px\]/);
}
assert.doesNotMatch(renderToStaticMarkup(<AiProse text={conclusion} />), /text-\[17px\]/);
assert.match(renderToStaticMarkup(<AiProse text={conclusion} highlightFirstSentence />), /text-\[17px\]/);
assert.match(readFileSync('components/InsightPanel.tsx', 'utf8'), /<AiProse text=\{m\.content\}[^>]*highlightFirstSentence/);
assert.doesNotMatch(readFileSync('app/heming/page.tsx', 'utf8'), /highlightFirstSentence/);
console.log('✓ Round15 D: 排盘/合盘姓名20字与旧标题截断、夏令时白话、只突出首句/保持Markdown与合盘不变');
