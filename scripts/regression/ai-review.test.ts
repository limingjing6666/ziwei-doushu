import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { STAR_DB } from '../../lib/ziwei/db-analysis';
import { ALL_STARS, ALL_TOPICS, getKnowledge, getAllKnowledgeRoutes } from '../../lib/seo/knowledge';
import { readSseData } from '../../lib/ai/sse';
import { consumeAiResponse } from '../../lib/ai/client';
import { streamDeepSeek } from '../../lib/ai/deepseek';
import { readBody, normalizeChart, AiError } from '../../lib/ai/input';
import { checkRateLimit } from '../../lib/ai/rate-limit';
import { safeReference, retrieveKnowledge } from '../../lib/ai/knowledge';
import { POST as interpret } from '../../app/api/interpret/route';
import { POST as heming } from '../../app/api/heming/route';

const encoder = new TextEncoder();
const stream = (text: string) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(encoder.encode(text)); c.close(); } });
const sse = (text: string) => new Response(stream(text), { headers: { 'Content-Type': 'text/event-stream' } });
const status = (code: number) => (e: unknown) => e instanceof AiError && e.status === code;
const visible = 'data: {"choices":[{"delta":{"content":"命宫天府，参考星性。"}}]}\n\n';
async function collect(body: ReadableStream<Uint8Array>) {
  const frames: string[] = [];
  for await (const frame of readSseData(body)) frames.push(frame);
  return frames;
}
async function main() {
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  try {
    for (const [key, profile] of Object.entries(STAR_DB)) {
      for (const [field, content] of Object.entries(profile) as [string, string][]) {
        assert.doesNotMatch(content, /\u5929\u7eaa|\u502a\u5e08|\u502a\u6d77\u53a6|\u502a\u5148\u751f|B\s*站|bilibili|BV\w+|\d{1,2}[:：]\d{2}|�/i, `${key}/${field}`);
        for (const [open, close] of [['「', '」'], ['『', '』'], ['“', '”'], ['（', '）']]) {
          assert.equal(content.split(open).length, content.split(close).length, `${key}/${field}: unbalanced ${open}`);
        }
        for (const paragraph of content.split('\n\n').filter(p => !p.startsWith('**【'))) {
          assert.doesNotMatch(paragraph, /\*|^[-#>」』”）]/, `${key}/${field}: markdown/orphan fragment`);
          assert.match(paragraph, /[。！？）」”]$/, `${key}/${field}: incomplete sentence`);
        }
      }
    }
    assert.equal(getAllKnowledgeRoutes().length, 182);
    for (const star of ALL_STARS) for (const topic of ALL_TOPICS) {
      const data = getKnowledge(star, topic);
      assert.ok(data.exists && (data.parsed.dingdiao || data.parsed.lundian), `${star}/${topic}`);
    }
    assert.equal(safeReference('公开内容。\n\n\u502a\u5148\u751f说「第一句。第二句。」\n\nB站第5讲。'), '公开内容。');
    assert.equal(safeReference('引用「第一句。第二句」（bIlIbIlI p05）。'), '');
    assert.deepEqual(await collect(stream(': ping\rdata: 一\rdata: 二\r\rdata: [DONE]')), ['一\n二', '[DONE]']);
    assert.deepEqual(await collect(stream(('data: 小\n\n').repeat(120000))), Array(120000).fill('小'));
    await assert.rejects(collect(stream('data: ' + 'x'.repeat(1024 * 1024))), /too large/);
    await assert.rejects(collect(stream(('data: ' + 'x'.repeat(1000) + '\n').repeat(1100))), /too large/);
    let cancelled = false;
    const trailing = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(encoder.encode('data: {"delta":{"text":"中文"}}\n\ndata: [DONE]\n\ndata: invalid\n\n')); }, cancel() { cancelled = true; } });
    await consumeAiResponse(new Response(trailing, { headers: { 'Content-Type': 'text/event-stream' } }), () => {});
    assert.ok(cancelled);
    for (const wire of ['data: [DONE]\n\n', 'data: null\n\n', 'data: invalid\n\n', 'data: {"error":"中断提示"}\n\ndata: [DONE]\n\n']) {
      await assert.rejects(consumeAiResponse(sse(wire), () => {}), /未收到|中断/);
    }
    await assert.rejects(consumeAiResponse(new Response('<html>not SSE</html>'), () => {}), /未收到/);
    const disconnect = new AbortController();
    let uploadCancelled = false;
    const pending = readBody(new Request('http://localhost', { method: 'POST', body: new ReadableStream({ cancel() { uploadCancelled = true; } }), signal: disconnect.signal, duplex: 'half' } as RequestInit));
    disconnect.abort();
    await assert.rejects(pending, status(408)); assert.ok(uploadCancelled);

    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
    const req = new Request('http://localhost');
    await assert.rejects(checkRateLimit(req), status(503));
    process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture';
    for (const results of [[{ result: 1 }, { result: 0 }, { result: 1 }, { result: 1 }], [null, null, null, null], [{ result: -1 }, { result: 1 }, { result: 1 }, { result: 1 }]]) {
      globalThis.fetch = async () => Response.json(results);
      await assert.rejects(checkRateLimit(req), status(503));
    }
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.DEEPSEEK_API_KEY = 'review-fixture-not-a-real-key';
    for (const suffix of ['', 'data: {"choices":[{"finish_reason":"length"}]}\n\ndata: [DONE]\n\n', 'data: {"error":"private upstream details"}\n\n', 'data: invalid\n\n']) {
      globalThis.fetch = async () => sse(visible + suffix);
      let partial = '';
      const response = await streamDeepSeek(req, 'test', []);
      const wire = await response.clone().text();
      assert.ok(wire.endsWith('data: [DONE]\n\n'), 'truncation/errors must still terminate the SSE protocol');
      await assert.rejects(consumeAiResponse(response, text => { partial = text; }), /解读暂时中断/);
      assert.match(partial, /命宫天府/); assert.doesNotMatch(partial, /private/);
    }
    globalThis.fetch = async () => sse('data: [DONE]\n\n');
    await assert.rejects(consumeAiResponse(await streamDeepSeek(req, 'test', []), () => {}), /中断/);
    let sourceCancelled = false;
    globalThis.fetch = async () => new Response(new ReadableStream({ cancel() { sourceCancelled = true; } }));
    await assert.rejects(consumeAiResponse(await streamDeepSeek(req, 'test', [], 10), () => {}), /中断/);
    assert.ok(sourceCancelled, 'timeout must cancel a pending read, not just the fetch signal');
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new Error('private')), { once: true }));
    await assert.rejects(streamDeepSeek(req, 'test', [], 10), status(504));

    Object.assign(process.env, { NODE_ENV: 'production', AI_MINUTE_LIMIT: '100', AI_DAILY_LIMIT: '100' });
    delete process.env.AI_ALLOWED_ORIGINS;
    const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
    const post = (body: unknown, origin = 'https://tianjipan.tech') => new Request('http://localhost', { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'x-real-ip': 'review-route' }, body: JSON.stringify(body) });
    globalThis.fetch = async (_url, init) => {
      const payload = JSON.parse(init!.body as string);
      assert.equal(payload.messages.filter((m: { role: string }) => m.role === 'system').length, 1);
      assert.ok(!JSON.stringify(payload).includes('injected-system'));
      assert.ok(JSON.stringify(payload).includes('命宫'));
      const context = JSON.parse(payload.messages[1].content.split('\n').slice(1).join('\n'));
      assert.ok(context.references.length <= 6000, 'actual route reference budget');
      if (context.chartB) assert.ok(context.references.includes('A方法[') && context.references.includes('B方法['));
      return sse(visible + 'data: [DONE]\n\n');
    };
    for (const response of [await interpret(post({ chart, messages: [{ role: 'system', content: 'injected-system' }, { role: 'user', content: '请解读' }] })), await heming(post({ chartA: chart, chartB: chart, question: '相处建议' }))]) {
      assert.equal(response.status, 200);
      await consumeAiResponse(response, () => {});
    }
    assert.ok(retrieveKnowledge(chart, chart).length <= 6000);
    const malformed = normalizeChart({ palaces: [{ name: '夫妻', stars: [{ type: 'major', name: 'constructor' }] }] });
    assert.doesNotThrow(() => retrieveKnowledge(malformed, malformed));
    assert.equal((await interpret(post({ chart }, 'https://evil.com'))).status, 403);
    assert.equal((await interpret(post({ chart: [] }))).status, 400);
    assert.equal((await heming(post({ chartA: chart }))).status, 400);
    assert.equal((await interpret(post({ chart, question: 'x'.repeat(205000) }))).status, 413);
    delete process.env.DEEPSEEK_API_KEY;
    for (const response of [await interpret(post({ chart })), await heming(post({ chartA: chart, chartB: chart }))]) {
      assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: 'AI 解读服务尚未配置，请稍后再试。' });
    }
    console.log('✓ AI review: all 650 profiles/182 SEO routes, bounded SSE/CR/UTF-8, explicit stream errors, timeout/disconnect, fail-closed Redis, actual route contracts/system-role filtering');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
