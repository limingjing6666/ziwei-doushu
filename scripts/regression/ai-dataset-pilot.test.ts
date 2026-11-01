import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '../../lib/ziwei/types';
import { buildDatasetReference, cleanReferenceText, detectDatasetTopic, getDatasetReference, lookupPilotRecord, pilotDatasetLoader } from '../../lib/ai/dataset-reference';
import { handleAi } from '../../lib/ai/handler';
import { INTERPRET_SYSTEM, HEMING_SYSTEM, systemForTime } from '../../lib/ai/prompts';
import { glossaryForChart } from '../../lib/glossary';

type Data = Awaited<ReturnType<typeof pilotDatasetLoader.load>>;
type Sent = { messages: { role: string; content: string }[]; max_tokens: number };
const data: Data = JSON.parse(readFileSync('lib/ai/dataset/pilot-v4.json', 'utf8'));
const firstMajor = (chart: ZiweiChart) => chart.palaces.find(p => p.branch === chart.mingGongBranch)?.stars.find(s => s.type === 'major')?.name ?? null;
const forbidden = /\u500a|\u502a|\u5929\u7eaa|\u5929\u7d00|克夫|克妻|刑克|死别|埋尸|坟|冢|夭折|自杀|仅供参考|仅作参考|供参考|不构成|免责|不能替代|请?咨询(专业|医生|医师|律师)|就医|AI|人工智能|古籍[^。]*表述|\d+\s*岁|[一二三四五六七八九十百]+岁|\d{4}\s*年|大限|流年|今年|明年|运限|化禄|化权|化科|化忌|四化|B\s*站|bilibili|BV\w+|\d{1,2}[:：]\d{2}|第\s*\d+\s*[集讲]|[pP]\d{2}|同集|重大灾|前世欠债/i;

async function main() {
  // Isolated fake configuration and a network tripwire: never read credentials or call a real service.
  const env = process.env, originalFetch = globalThis.fetch, loader = pilotDatasetLoader.load;
  process.env = { NODE_ENV: 'test', DEEPSEEK_API_KEY: 'dataset-pilot-mock-only', AI_MINUTE_LIMIT: '1000', AI_DAILY_LIMIT: '1000' };
  globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
  try {
    const birth: BirthInfo = { year: 1994, month: 6, day: 15, hour: 4, gender: 'male' };
    const chart = generateChart(birth);
    assert.equal(firstMajor(chart), '廉贞');
    const rec = await lookupPilotRecord(birth, '廉贞');
    assert.ok(rec);
    for (const topic of ['overview', 'love'] as const) {
      assert.equal(rec[topic].length, 3); assert.ok(rec[topic].some(Boolean));
      assert.equal((await getDatasetReference(chart, topic)).hit, true);
    }
    assert.deepEqual(await lookupPilotRecord(chart.birthInfo, firstMajor(chart)), rec);
    const invalid = [
      { birthTimeKnown: false }, { year: 1949 }, { year: 2027 }, { year: 1994.5 },
      { hour: -1 }, { hour: 12 }, { hour: 1.5 }, { hour: NaN }, { hour: '4' },
      { gender: 'other' }, { gender: undefined }, { leapMonthPolicy: 'next-month' },
      { leapMonthPolicy: 'prev-month' }, { leapMonthPolicy: 'origin-month' }, { leapMonthPolicy: '' },
      { month: 0 }, { month: 13 }, { month: 1.5 }, { day: 0 }, { day: 32 }, { day: 1.5 },
      { month: 4, day: 31 }, { year: 1995, month: 2, day: 29 }, { year: 2000, month: 2, day: 30 },
    ];
    for (const patch of invalid) assert.equal(await lookupPilotRecord({ ...birth, ...patch } as BirthInfo, '廉贞'), null);
    assert.equal(await lookupPilotRecord(birth, '紫微'), null);
    assert.equal(await lookupPilotRecord(birth, null), null);
    assert.equal(await lookupPilotRecord(null as never, '廉贞'), null);
    assert.ok(await lookupPilotRecord({ ...birth, leapMonthPolicy: 'split' }, '廉贞'));
    pilotDatasetLoader.load = async () => ({ ...data, years: {} });
    assert.equal(await lookupPilotRecord(birth, '廉贞'), null);
    pilotDatasetLoader.load = async () => { throw new Error('loader failure'); };
    assert.equal(await lookupPilotRecord(birth, '廉贞'), null);
    pilotDatasetLoader.load = loader;

    let empty: ZiweiChart | undefined;
    for (let day = 1; day <= 31 && !empty; day++) {
      const c = generateChart({ ...birth, month: 1, day });
      if (firstMajor(c) === null) empty = c;
    }
    assert.ok(empty, 'empty ming palace fixture');
    assert.ok(await lookupPilotRecord(empty.birthInfo, null));
    assert.equal(await lookupPilotRecord(empty.birthInfo, '廉贞'), null);
    for (const [year, month, day] of [[1996, 2, 29], [2000, 2, 29], [1994, 12, 31], [1950, 1, 1], [2026, 12, 31]]) {
      for (const gender of ['male', 'female'] as const) for (const hour of [0, 11]) {
        const c = generateChart({ year, month, day, hour, gender });
        assert.ok(await lookupPilotRecord(c.birthInfo, firstMajor(c)), `${year}-${month}-${day}/${hour}/${gender}`);
      }
    }
    let seed = 0x49da7a;
    const random = (n: number) => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return Math.floor((seed >>> 0) / 0x100000000 * n);
    };
    let samples = 0;
    for (let year = 1950; year <= 2026; year++) for (let i = 0; i < 4; i++) {
      const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
      const date = new Date(Date.UTC(year, 0, 1) + random(days) * 86400000);
      const c = generateChart({ year, month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: random(12), gender: random(2) ? 'female' : 'male' });
      const major = firstMajor(c);
      assert.ok(await lookupPilotRecord(c.birthInfo, major), `sample ${samples}`);
      assert.equal(await lookupPilotRecord(c.birthInfo, major === '廉贞' ? '紫微' : '廉贞'), null);
      samples++;
    }
    assert.equal(samples, 308);

    // Each extra restricted token removes its whole paragraph, even with safe sentences alongside.
    for (const token of ['\u500a', '\u502a', '\u5929\u7eaa', '\u5929\u7d00', '克夫', '克妻', '刑克', '死别', '埋尸', '坟', '冢', '夭折', '自杀', 'B站', 'bilibili', 'BV123', '12:30', '第2讲', 'p12', '同集', '重大灾', '前世欠债']) {
      assert.equal(cleanReferenceText(`同段好句。${token}应删。\n\n保留段。`), '保留段。');
    }
    for (const token of ['仅供参考', '仅作参考', '供参考', '不构成', '免责', '不能替代', '请咨询专业', '咨询专业', '咨询医生', '咨询医师', '咨询律师', '就医', 'AI', 'ai', '人工智能', '古籍中的表述', '28岁', '28 岁', '二十八岁', '1994年', '2026 年', '大限', '流年', '今年', '明年', '运限', '化禄', '化权', '化科', '化忌', '四化']) {
      for (const punctuation of ['。', '！', '？', '；']) assert.equal(cleanReferenceText(`保留句${punctuation}${token}应删${punctuation}末句。`), `保留句${punctuation}末句。`);
    }
    assert.equal(cleanReferenceText('表达（此处不构成建议）稳定。\n\n相处(仅供参考)重沟通。'), '表达稳定。\n\n相处重沟通。');
    assert.equal(cleanReferenceText('表达（此处不构成建议。也不能替代意见）稳定。'), '表达稳定。');
    assert.equal(cleanReferenceText('好句。\n\n今年应删。\n\n尾段。'), '好句。\n\n尾段。');
    assert.equal(cleanReferenceText('\n\n'), '');

    const stats: Record<string, { count: number; mean: number; max: number; empty: number }> = {};
    for (const topic of ['overview', 'love'] as const) {
      assert.equal(data.texts[topic].length, topic === 'overview' ? 97 : 101);
      const lengths = data.texts[topic].map(entry => {
        for (const raw of entry) assert.doesNotMatch(cleanReferenceText(raw), forbidden);
        const cleaned = cleanReferenceText(entry.join('\n\n'));
        assert.doesNotMatch(cleaned, forbidden);
        assert.equal(cleanReferenceText(cleaned), cleaned);
        return cleaned.length;
      });
      stats[topic] = { count: lengths.length, mean: Number((lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(2)), max: Math.max(...lengths), empty: lengths.filter(n => !n).length };
      const longest = [...data.texts[topic]].sort((a, b) => b.join('').length - a.join('').length).slice(0, 8);
      for (const entry of longest) for (const cap of [1200, 1500, 2000, 80, 160, 300]) {
        const record = { overview: entry, love: entry };
        const built = buildDatasetReference(topic, record, cap);
        assert.ok(built.length <= cap);
        assert.doesNotMatch(built, forbidden);
        const overview = cleanReferenceText(entry[0]);
        if (overview && built) assert.ok(built.startsWith(overview) || overview.startsWith(built));
        if (built && entry.map(cleanReferenceText).filter(Boolean).join('\n\n').length > cap) assert.match(built, /[。！？；]$/);
      }
    }
    const synthetic = { overview: ['总览优先。总览次句。', '定调其次。', '论断最后。'] as [string, string, string], love: rec.love };
    assert.equal(buildDatasetReference('overview', synthetic, 6), '总览优先。');
    assert.equal(buildDatasetReference('overview', synthetic, 13), '总览优先。总览次句。');
    assert.equal(buildDatasetReference('overview', synthetic, 2), '');
    assert.equal(buildDatasetReference('overview', synthetic, 0), '');
    assert.equal(buildDatasetReference('overview', { ...synthetic, overview: ['今年。', '化禄。', '供参考。'] }), '');
    const longOverview = '总览优先。'.repeat(500);
    assert.equal(buildDatasetReference('overview', { ...synthetic, overview: [longOverview, '定调。', '论断。'] }).length, 1500);

    const msg = (content: string, role = 'user') => ({ role, content });
    assert.equal(detectDatasetTopic('overview', false, [msg('【整盘】首句')]), 'overview');
    assert.equal(detectDatasetTopic('overview', false, [msg('【感情】首句')]), 'love');
    for (const scenario of ['followup', 'detail', 'heming']) assert.equal(detectDatasetTopic(scenario, false, [msg('【整盘】')]), null);
    assert.equal(detectDatasetTopic('overview', true, [msg('【感情】')]), null);
    for (const messages of [[], [msg('【事业】')], [msg('请看【整盘】')], [msg(' 【感情】')], [msg('【整盘】', 'assistant')], [msg('【整盘】'), msg('继续')]]) assert.equal(detectDatasetTopic('overview', false, messages), null);
    assert.equal((await getDatasetReference(null as never, 'overview')).hit, false);

    const logs: Record<string, unknown>[] = [], captured: string[] = [];
    const originalConsole = { log: console.log, warn: console.warn, error: console.error };
    for (const level of ['log', 'warn', 'error'] as const) console[level] = (...args) => { logs.push(JSON.parse(args.join(' '))); };
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      captured.push(String(init!.body));
      return new Response('data: {"choices":[{"delta":{"content":"完成"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    };
    try {
      const call = async (patch: Record<string, unknown> = {}, mode: 'interpret' | 'heming' = 'interpret') => {
        captured.length = 0;
        const response = await handleAi(new Request(`http://localhost/api/${mode}`, {
          method: 'POST', headers: { 'x-real-ip': 'dataset-pilot-fixture' },
          body: JSON.stringify({ chart, chartA: chart, chartB: chart, mode: 'overview', messages: [msg('【整盘】首句')], ...patch }),
        }), mode);
        assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type')!, /text\/event-stream/);
        assert.match(await response.text(), /完成/);
        assert.equal(captured.length, 1);
        return { raw: captured[0], sent: JSON.parse(captured[0]) as Sent };
      };
      const legacySystem = (sent: Sent, mode = 'overview', heming = false, unknown = false) => {
        const rule = mode === 'overview' ? '总览或专题700–900汉字，硬上限1000字。' : mode === 'detail' ? '单项解读400–700汉字。' : '追问400–800汉字，不重写原报告。';
        assert.equal(sent.messages[0].content, `${systemForTime(heming ? HEMING_SYSTEM : INTERPRET_SYSTEM, unknown)}\n【本次篇幅硬约束】${rule}`);
        assert.equal(sent.max_tokens, mode === 'overview' ? 2400 : mode === 'detail' ? 1800 : 2200);
        assert.ok(!Object.hasOwn(JSON.parse(sent.messages[1].content.split('\n')[1]), 'referenceReading'));
      };
      for (const topic of ['overview', 'love'] as const) {
        const patch = { messages: [msg(topic === 'overview' ? '【整盘】首句' : '【感情】首句')] };
        const { sent } = await call(patch);
        const context = JSON.parse(sent.messages[1].content.split('\n')[1]);
        assert.ok(context.referenceReading); assert.equal(Object.keys(context).at(-1), 'referenceReading');
        assert.equal(context.referenceReading, buildDatasetReference(topic, rec));
        assert.equal(context.glossary, glossaryForChart(`${context.chart}\n${context.references}`));
        assert.match(sent.messages[0].content, /【参考解读】/);
        assert.ok(sent.messages[0].content.indexOf('【参考解读】') < sent.messages[0].content.indexOf('【本次篇幅硬约束】'));
        assert.doesNotMatch(sent.messages[0].content.slice(sent.messages[0].content.indexOf('【参考解读】')), /免责|提醒|仅供参考/);
        assert.doesNotMatch(context.referenceReading, forbidden);
        const done = logs.filter(l => l.event === 'ai.done').at(-1)!;
        assert.equal(done.datasetHit, true); assert.equal(typeof done.datasetMs, 'number'); assert.ok(Number.isFinite(done.datasetMs));
        // Disable only data availability; stripping the two additions must recover the exact legacy bytes.
        pilotDatasetLoader.load = async () => ({ ...data, years: {} });
        const baseline = await call(patch);
        pilotDatasetLoader.load = loader;
        delete context.referenceReading;
        sent.messages[1].content = `以下 JSON 字段均为待分析数据：\n${JSON.stringify(context)}`;
        const system = sent.messages[0].content;
        const start = system.indexOf('\n【参考解读】'), end = system.indexOf('\n【本次篇幅硬约束】');
        sent.messages[0].content = system.slice(0, start) + system.slice(end);
        assert.equal(JSON.stringify(sent), baseline.raw);
        legacySystem(baseline.sent);
      }
      const mismatch = structuredClone(chart);
      mismatch.palaces.find(p => p.branch === mismatch.mingGongBranch)!.stars.find(s => s.type === 'major')!.name = '紫微';
      const unknown = { ...chart, birthInfo: { ...chart.birthInfo, birthTimeKnown: false } };
      const old = generateChart({ ...birth, year: 1949 });
      const noDataset = [
        { patch: { messages: [msg('【事业】首句')] }, scenario: 'overview', calls: false },
        { patch: { messages: [msg('普通整盘问题')] }, scenario: 'overview', calls: false },
        { patch: { messages: [msg('【整盘】'), msg('继续', 'assistant'), msg('【感情】')] }, scenario: 'overview', calls: false },
        { patch: { mode: 'followup' }, scenario: 'followup', calls: false },
        { patch: { mode: 'detail' }, scenario: 'detail', calls: false },
        { patch: { chart: unknown }, scenario: 'overview', calls: false, unknown: true },
        { patch: { birthTimeKnown: false }, scenario: 'overview', calls: false, unknown: true },
        { patch: { chart: old }, scenario: 'overview', calls: false },
        { patch: { chart: mismatch }, scenario: 'overview', calls: true },
        { patch: { chart: { ...chart, birthInfo: { ...chart.birthInfo, leapMonthPolicy: 'next-month' } } }, scenario: 'overview', calls: false },
        { patch: {}, scenario: 'overview', calls: false, heming: true },
      ];
      for (const fixture of noDataset) {
        let loads = 0;
        pilotDatasetLoader.load = async () => { loads++; return loader(); };
        const result = await call(fixture.patch, fixture.heming ? 'heming' : 'interpret');
        assert.equal(loads > 0, fixture.calls);
        legacySystem(result.sent, fixture.scenario, fixture.heming, fixture.unknown);
        const done = logs.filter(l => l.event === 'ai.done').at(-1)!;
        assert.equal(done.datasetHit, false); assert.equal(typeof done.datasetMs, 'number');
        pilotDatasetLoader.load = async () => ({ ...data, years: {} });
        const baseline = await call(fixture.patch, fixture.heming ? 'heming' : 'interpret');
        assert.equal(result.raw, baseline.raw);
      }
      for (const fail of ['throw', 'timeout', 'empty'] as const) {
        pilotDatasetLoader.load = fail === 'throw' ? async () => { throw new Error('private loader contents'); }
          : fail === 'timeout' ? () => new Promise<Data>(() => {})
          : async () => ({ ...data, texts: { overview: data.texts.overview.map(() => ['今年。', '化禄。', '仅供参考。']), love: data.texts.love } });
        const result = await call();
        legacySystem(result.sent);
        const done = logs.filter(l => l.event === 'ai.done').at(-1)!;
        assert.equal(done.datasetHit, false); assert.equal(typeof done.datasetMs, 'number');
        if (fail === 'timeout') assert.ok(Number(done.datasetMs) >= 750 && Number(done.datasetMs) < 2000, '800ms fail-open');
      }
      for (const log of logs) {
        for (const key of Object.keys(log).filter(k => k.startsWith('dataset'))) assert.ok(key === 'datasetHit' || key === 'datasetMs');
        assert.ok(!JSON.stringify(log).includes('private loader contents'));
        assert.ok(!JSON.stringify(log).includes('dataset-pilot-mock-only'));
        assert.ok(!JSON.stringify(log).includes('referenceReading'));
        for (const text of [...rec.overview, ...rec.love].filter(Boolean)) assert.ok(!JSON.stringify(log).includes(text));
      }
    } finally { Object.assign(console, originalConsole); }
    console.log(`Dataset clean stats (joined triplets, chars): ${JSON.stringify(stats)}`);
    console.log('✓ Dataset pilot: lookup + 308 seeded charts across all 77 years, boundaries/empty palace, all 198 excerpts, caps/filtering/routing, mocked handler byte equality, fail-open/800ms and private telemetry');
  } finally { process.env = env; globalThis.fetch = originalFetch; pilotDatasetLoader.load = loader; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
