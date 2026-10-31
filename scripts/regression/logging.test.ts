import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import { recordVisit, visitData, visitStats, shouldRecord, isBot, pruneVisits } from '../../lib/visitlog';
import { syslog } from '../../lib/syslog';
import { authorized } from '../../lib/stats-auth';
import { GET } from '../../app/api/admin/stats/route';
import { streamDeepSeek, deepSeekRewriter } from '../../lib/ai/deepseek';
import { AiTelemetry } from '../../lib/ai/telemetry';
import { handleAi } from '../../lib/ai/handler';
import { proxy } from '../../proxy';
import { NextRequest, type NextFetchEvent } from 'next/server';

async function main() {
  const logs: { level: string; line: string }[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of ['log','warn','error'] as const) console[level] = (...args) => logs.push({ level, line: args.join(' ') });
  const db = new PGlite();
  const req = (path: string, headers: Record<string,string> = {}, method = 'GET') => new Request(`http://localhost${path}`, { method, headers: { 'user-agent': 'Mozilla/5.0', ...headers } });
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  try {
    delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.STATS_EXCLUDE_IPS;
    // Next strips RSC/prefetch indicators without this flag, even before proxy runs.
    assert.equal(createRequire(import.meta.url)('../../next.config.js').skipProxyUrlNormalize, true);
    const input = req('/chart?birth=secret', { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', referer: 'https://other.example/a?q=private#birth', 'x-vercel-ip-city': '%E9%A6%99%E6%B8%AF' });
    const d = visitData(input);
    assert.equal(d.ip, '203.0.113.9'); assert.equal(d.city, '香港'); assert.equal(d.path, '/chart'); assert.equal(d.referrer, 'https://other.example/a');
    assert.equal(visitData(req('/', { 'x-real-ip': '127.0.0.1' })).ip, '127.0.0.1');
    assert.equal(visitData(req('/')).ip, null);
    assert.equal(visitData(req('/', { 'x-vercel-ip-city': '%zz' })).city, '%zz');
    for (const ua of ['', 'Googlebot', 'BingPreview','HeadlessChrome','curl/8','python-requests','UptimeRobot','facebookexternalhit','node-fetch','crawler','preview','Wget']) assert.equal(isBot(ua), true, ua);
    assert.equal(isBot('Mozilla/5.0 Safari'), false);
    for (const request of [req('/x.png'), req('/_next/static/x'),req('/api/admin/stats'),req('/api/cron/prune-visits'),req('/manifest.webmanifest'),req('/favicon'),req('/?x=1', { 'next-router-prefetch': '' }),req('/', { purpose: 'prefetch' }),req('/', { 'sec-purpose': 'prefetch;prerender' }),req('/', { rsc: '1' }),req('/?_rsc=1'),req('/', {}, 'HEAD'),req('/', {}, 'OPTIONS')]) assert.equal(shouldRecord(request), false, request.url);
    assert.equal(shouldRecord(input), true); assert.equal(shouldRecord(req('/api/interpret', {}, 'POST')), true); assert.equal(shouldRecord(req('/api/heming', {}, 'POST')), true);
    await recordVisit(input); // no DB, silent
    const waits: Promise<unknown>[] = [];
    proxy(new NextRequest('http://localhost/chart?birth=private'), { waitUntil: (p: Promise<unknown>) => waits.push(p) } as unknown as NextFetchEvent);
    await Promise.all(waits);
    assert.equal(logs.filter(l => JSON.parse(l.line).event === 'visit.disabled').length, 1);
    await recordVisit(input, db);
    await recordVisit(req('/', { 'x-forwarded-for': '203.0.113.9' }), db);
    await recordVisit(req('/other', { 'x-forwarded-for': '203.0.113.10', referer: 'https://tianjipan.tech/chart?private=1' }), db);
    await recordVisit(req('/preview', { referer: 'https://tianjipan-branch.vercel.app/' }), db);
    await recordVisit(req('/bot', { 'user-agent': 'curl/8', 'x-forwarded-for': '203.0.113.11' }), db);
    await recordVisit(req('/api/interpret', { 'x-forwarded-for': '203.0.113.9' }, 'POST'), db);
    process.env.STATS_EXCLUDE_IPS = '203.0.113.12, 127.0.0.1';
    await recordVisit(req('/excluded', { 'x-real-ip': '127.0.0.1' }), db);
    let stats = await visitStats(db);
    assert.deepEqual(stats.totals, { pv: 4, uv: 2, aiCalls: 1, aiUv: 1 });
    assert.equal((await visitStats(db, 7, true)).totals.pv, 5);
    assert.equal(stats.topPages.find(p => p.path === '/chart')?.pv, 1);
    assert.deepEqual(stats.topReferrers.map(r => r.host).sort(), ['direct','other.example']);
    assert.equal(stats.topIps.find(p => p.ip === '203.0.113.9')?.aiCalls, 1);
    assert.equal(stats.aiByRoute[0].route, 'interpret');
    await recordVisit(req('/external-preview', { referer: 'https://another-project.vercel.app/' }), db);
    assert((await visitStats(db)).topReferrers.some(r => r.host === 'another-project.vercel.app'));
    const stored = (await db.query<{path:string;referrer:string}>('SELECT path,referrer FROM visit_log')).rows;
    for (const row of stored) { assert(!row.path.includes('?')); assert(!row.referrer.includes('?')); assert(!row.referrer.includes('#')); }
    // Two timestamps around yesterday's Hong Kong midnight, independent of runner timezone.
    await db.query('TRUNCATE visit_log');
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Hong_Kong' });
    const midnight = new Date(`${today}T00:00:00+08:00`).getTime() - 86400000;
    for (const offset of [-1000,1000,2000]) await db.query(`INSERT INTO visit_log (ts,ip,path,kind) VALUES ($1,'same','/bucket','page')`, [new Date(midnight + offset).toISOString()]);
    stats = await visitStats(db);
    assert.equal(stats.daily.length, 2); assert.deepEqual(stats.daily.map(d => d.pv), [1,2]); assert.deepEqual(stats.daily.map(d => d.uv), [1,1]); assert.equal(stats.totals.uv, 1);
    await db.query(`INSERT INTO visit_log (ts,kind) VALUES (now()-interval '31 days','page')`);
    assert.equal(await pruneVisits(db), 1);
    // Failed DDL/write cannot escape request logging; repeated failures are rate limited.
    const broken = { query: async () => { throw new Error('private failure'); } };
    await recordVisit(input, broken); await recordVisit(input, broken);
    assert.equal(logs.filter(l => JSON.parse(l.line).event === 'visit.write_error').length, 1);

    process.env.STATS_ADMIN_TOKEN = 'local-test-secret';
    assert.equal((await GET(req('/api/admin/stats'))).status, 401);
    assert.equal((await GET(req('/api/admin/stats', { authorization: 'Bearer wrong' }))).status, 401);
    const ok = await GET(req('/api/admin/stats', { authorization: 'Bearer local-test-secret' }));
    assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { enabled: false, reason: 'DATABASE_URL not set' });
    assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.equal(ok.headers.get('x-robots-tag'), 'noindex');
    assert(!authorized(req('/', { authorization: 'Bearer undefined' }), undefined));
    delete process.env.STATS_ADMIN_TOKEN;
    assert.equal((await GET(req('/api/admin/stats'))).status, 401);
    syslog('warn', 'test.safety', { ip: '203.0.113.1', question: 'private question', birth: 'private birth', errorMessage: '203.0.113.2 ::1 2001:db8::1 test@example.com ' + 'x'.repeat(300), route: 'a\nb' });
    const safety = logs.at(-1)!; const safe = JSON.parse(safety.line);
    assert.equal(safety.level, 'warn'); assert.equal(safe.ip, undefined); assert.equal(safe.question, undefined); assert.equal(safe.birth, undefined); assert(safe.errorMessage.length <= 200); assert(!/203\.0|test@|2001:|::1/.test(safe.errorMessage)); assert.equal(safety.line.split('\n').length, 1);
    syslog('error', 'test.error'); assert.equal(logs.at(-1)!.level, 'error');

    process.env.DEEPSEEK_API_KEY = 'mock-key';
    let sentUsage = false;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (!body.stream) return Response.json({ choices: [{ message: { content: '["fixed"]' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
      sentUsage = body.stream_options.include_usage === true;
      return new Response('data: {"choices":[{"delta":{"content":"private output"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"prompt_cache_hit_tokens":4,"prompt_cache_miss_tokens":6}}\n\ndata: [DONE]\n\n');
    };
    const telemetry = new AiTelemetry('interpret'); telemetry.context('overview', true);
    const stream = await streamDeepSeek(req('/api/interpret'), 'private system', [{ role: 'user', content: 'private question' }], 1000, 100, telemetry);
    const wrapped = telemetry.response(stream); assert(wrapped.headers.get('x-request-id'));
    await wrapped.text(); assert(sentUsage);
    const done = logs.map(l => JSON.parse(l.line)).filter(l => l.event === 'ai.done').at(-1);
    assert.equal(done.totalTokens, 15); assert.equal(done.cacheHitTokens, 4); assert.equal(done.truncated, true); assert.equal(done.outputChars, 14);
    const rewriteTelemetry = new AiTelemetry('interpret');
    await deepSeekRewriter(new AbortController().signal, rewriteTelemetry)([{ text: 'private paragraph', types: [], start: 0, end: 17 }], 'private facts', 1000);
    await rewriteTelemetry.response(new Response('data: [DONE]\n\n')).text();
    const rewriteDone = logs.map(l => JSON.parse(l.line)).filter(l => l.event === 'ai.done').at(-1);
    assert.equal(rewriteDone.totalTokens, 3); assert.equal(rewriteDone.repaired, true);
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.AI_MINUTE_LIMIT = '100';
    const chart = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
    const success = await handleAi(new Request('http://localhost/api/interpret', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chart, mode: 'overview', question: 'private question' }) }), 'interpret');
    assert.equal(success.status, 200); await success.text();
    const handlerDone = logs.map(l => JSON.parse(l.line)).filter(l => l.event === 'ai.done').at(-1);
    assert.equal(handlerDone.totalTokens, 15); assert.equal(handlerDone.truncated, true);
    const bad = await handleAi(req('/api/interpret', { 'content-type': 'application/json' }, 'POST'), 'interpret');
    assert(bad.status >= 400); assert(bad.headers.get('x-request-id'));
    for (const l of logs) assert(!/private question|private birth|private output|private paragraph|private facts|private system|mock-key|local-test-secret/.test(l.line));
  } finally {
    await db.close(); process.env = saved; globalThis.fetch = realFetch; Object.assign(console, original);
  }
  console.log('logging: all checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
