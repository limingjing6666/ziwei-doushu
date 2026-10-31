import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { chartToText, crossTransformations } from '../../lib/ai/chart-to-text';
import { normalizeChart, normalizeMessages, readBody, AiError } from '../../lib/ai/input';
import { readSseData } from '../../lib/ai/sse';
import { consumeAiResponse } from '../../lib/ai/client';
import { streamDeepSeek } from '../../lib/ai/deepseek';
import { checkOrigin, checkRateLimit } from '../../lib/ai/rate-limit';
import { STAR_DB } from '../../lib/ziwei/db-analysis';
import { ALL_STARS, getKnowledge } from '../../lib/seo/knowledge';

const encoder = new TextEncoder();
function fragmented(value: string) {
  const bytes = encoder.encode(value);
  return new ReadableStream<Uint8Array>({ start(c) {
    for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
    c.close();
  } });
}
const errorStatus = (status: number) => (e: unknown) => e instanceof AiError && e.status === status;
async function main() {
  const fetchOriginal = globalThis.fetch;
  const env = { ...process.env };
  try {
    for (const star of ALL_STARS) {
      for (const field of ['mingGong', 'fuQi', 'caiBo', 'guanLu'] as const) assert.ok(STAR_DB[star]?.[field], `${star}/${field}`);
      for (const topic of ['overview', 'love', 'wealth', 'career'] as const) assert.ok(getKnowledge(star, topic).exists);
    }
    assert.ok(Object.keys(STAR_DB).some(k => k.startsWith('空宫借:')));
    assert.doesNotMatch(JSON.stringify(STAR_DB), /天纪|倪师|倪海厦|bilibili|BV\w+|\d{1,2}[:：]\d{2}/);
    assert.throws(() => normalizeChart([]), errorStatus(400));
    const partial = normalizeChart({ palaces: [null, { stars: [null, { name: '紫微', type: 'major' }] }] });
    assert.equal(partial.palaces.length, 1);
    assert.match(chartToText({}), /未提供/);
    assert.equal(normalizeMessages(Array.from({ length: 20 }, () => ({ role: 'user', content: '字'.repeat(3000) }))).length, 12);
    assert.equal(normalizeMessages([{ role: 'system', content: 'bad' }, { role: 'user', content: '字'.repeat(3000) }])[0].content.length, 2000);
    const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
    const other = generateChart({ year: 1992, month: 6, day: 15, hour: 5, gender: 'female' });
    const summary = chartToText(chart);
    assert.match(summary, /天府（庙）/);
    assert.match(summary, /空宫；仅借对宫/);
    assert.match(summary, /生年四化/);
    assert.match(summary, /当前大限/);
    assert.match(chartToText(normalizeChart({ ...chart, liunianYear: 2026 })), /流年干丙四化/);
    assert.doesNotMatch(chartToText({ ...chart, birthInfo: { ...chart.birthInfo, name: '隐私姓名', city: '隐私城市' } }), /隐私姓名|隐私城市/);
    const cross = crossTransformations(chart, other);
    assert.match(cross, /A→B（生年干己）：武曲化禄→父母/);
    assert.match(cross, /B→A（生年干壬）：天梁化禄→仆役/);
    const frames: string[] = [];
    for await (const data of readSseData(fragmented(': ping\r\ndata: {"delta":{"text":"中文"}}\r\n\r\ndata: [DONE]\n\n'))) frames.push(data);
    assert.deepEqual(frames, ['{"delta":{"text":"中文"}}', '[DONE]']);
    let output = '';
    await consumeAiResponse(new Response(fragmented('data: {"delta":{"text":"中文"}}\n\ndata: [DONE]\n\n')), s => { output = s; });
    assert.equal(output, '中文');
    await assert.rejects(consumeAiResponse(Response.json({ error: '请求太频繁' }, { status: 429 }), () => {}), /请求太频繁/);
    await assert.rejects(consumeAiResponse(new Response(fragmented('data: {"delta":{"text":"部分"}}\n\n')), () => {}), /中断/);
    await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', body: ' '.repeat(205000) })), errorStatus(413));
    const tooLarge = new Request('http://localhost', { method: 'POST', body: fragmented(' '.repeat(205000)), duplex: 'half' } as RequestInit);
    await assert.rejects(readBody(tooLarge), errorStatus(413));
    await assert.rejects(readBody(new Request('http://localhost', { method: 'POST', body: 'oops' })), errorStatus(400));

    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.AI_ALLOWED_ORIGINS;
    for (const origin of ['https://tianjipan.tech', 'https://a.vercel.app', 'http://localhost:3000']) checkOrigin(new Request('http://localhost', { headers: { origin } }));
    for (const origin of ['null', 'https://evil.com', 'https://tianjipan.tech.evil.com', 'https://a.vercel.app.evil.com']) assert.throws(() => checkOrigin(new Request('http://localhost', { headers: { origin } })), errorStatus(403));
    assert.throws(() => checkOrigin(new Request('http://localhost', { headers: { origin: 'https://tianjipan.tech', referer: 'https://evil.com/' } })), errorStatus(403));
    process.env.AI_ALLOWED_ORIGINS = 'https://custom.example:444';
    checkOrigin(new Request('http://localhost', { headers: { origin: 'https://custom.example:444' } }));
    assert.throws(() => checkOrigin(new Request('http://localhost', { headers: { origin: 'https://tianjipan.tech' } })), errorStatus(403));

    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.AI_MINUTE_LIMIT = '1'; process.env.AI_DAILY_LIMIT = '30';
    const req = new Request('http://localhost', { headers: { 'x-forwarded-for': 'test-minute,proxy' } });
    await checkRateLimit(req);
    await assert.rejects(checkRateLimit(req), errorStatus(429));
    process.env.AI_MINUTE_LIMIT = '20'; process.env.AI_DAILY_LIMIT = '1';
    const daily = new Request('http://localhost', { headers: { 'x-real-ip': 'test-daily' } });
    await checkRateLimit(daily); await assert.rejects(checkRateLimit(daily), errorStatus(429));
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    globalThis.fetch = async (_url, init) => {
      const commands = JSON.parse(init!.body as string);
      assert.equal(commands[0][0], 'INCR'); assert.equal(commands[1][0], 'EXPIRE');
      assert.equal(commands.length, 4);
      assert.doesNotMatch(commands[0][1], /test-minute/);
      return Response.json([{ result: 1 }, { result: 1 }, { result: 1 }, { result: 1 }]);
    };
    await checkRateLimit(req);
    globalThis.fetch = async () => Response.json([{ error: 'unavailable' }]);
    await assert.rejects(checkRateLimit(req), errorStatus(503));

    delete process.env.DEEPSEEK_API_KEY;
    await assert.rejects(streamDeepSeek(req, 'test', []), errorStatus(500));
    process.env.DEEPSEEK_API_KEY = 'test-fixture-not-a-real-key'; delete process.env.DEEPSEEK_MODEL;
    globalThis.fetch = async (_url, init) => {
      const sent = JSON.parse(init!.body as string);
      assert.equal(sent.model, 'deepseek-flash'); assert.equal(sent.stream, true);
      return new Response(fragmented('data: {"choices":[{"delta":{"reasoning_content":"不可见"}}]}\n\ndata: {"choices":[{"delta":{"content":"命宫天府，重视积累。"}}]}\n\ndata: [DONE]\n\n'));
    };
    const response = await streamDeepSeek(req, 'test', []);
    assert.match(response.headers.get('content-type')!, /text\/event-stream/);
    const wire = await response.text();
    assert.match(wire, /"delta":\{"text":"命宫天府/); assert.ok(wire.endsWith('data: [DONE]\n\n')); assert.doesNotMatch(wire, /不可见|reasoning/);
    globalThis.fetch = async () => new Response('private error must not leak', { status: 401 });
    await assert.rejects(streamDeepSeek(req, 'test', []), errorStatus(502));
    globalThis.fetch = async () => new Response(fragmented('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n'));
    assert.match(await (await streamDeepSeek(req, 'test', [])).text(), /解读暂时中断/);
    let upstreamSignal: AbortSignal | undefined;
    globalThis.fetch = async (_url, init) => {
      upstreamSignal = init?.signal as AbortSignal;
      return new Response(new ReadableStream({ start(c) { c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"开始"}}]}\n\n')); } }));
    };
    const cancellable = await streamDeepSeek(req, 'test', []);
    const reader = cancellable.body!.getReader();
    await reader.read(); await reader.cancel();
    assert.equal(upstreamSignal!.aborted, true);
    const disconnect = new AbortController();
    const disconnected = await streamDeepSeek(new Request('http://localhost', { signal: disconnect.signal }), 'test', []);
    const disconnectReader = disconnected.body!.getReader();
    await disconnectReader.read(); disconnect.abort();
    assert.equal(upstreamSignal!.aborted, true);
    await disconnectReader.cancel();
    console.log('✓ AI backend: coverage, privacy normalization, SSE fragmentation, validation, origins, quotas, Redis, DeepSeek proxy/cancellation');
  } finally {
    globalThis.fetch = fetchOriginal;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
