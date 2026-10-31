import { Pool } from 'pg';
import { syslog } from './syslog';
import { VISIT_RETENTION_DAYS } from './visit-policy';
export { VISIT_RETENTION_DAYS } from './visit-policy';
// Shared contract supports both pg and embedded PostgreSQL in regression tests.
export interface Queryable { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> }
let pool: Pool | undefined;
let disabled = false;
let lastError = 0;
export function visitError() {
  if (Date.now() - lastError >= 60000) { lastError = Date.now(); syslog('warn', 'visit.write_error', { errorClass: 'DatabaseError' }); }
}
export function database(): Queryable | undefined {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) { if (!disabled) { disabled = true; syslog('info', 'visit.disabled'); } return; }
  if (!pool) { pool = new Pool({ connectionString: url, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 3000, statement_timeout: 3000, allowExitOnIdle: true }); pool.on('error', visitError); }
  return pool;
}
const schemas = new WeakMap<Queryable, Promise<void>>();
export function ensureSchema(db: Queryable) {
  let ready = schemas.get(db);
  if (!ready) {
    ready = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS visit_log (id bigserial PRIMARY KEY, ts timestamptz NOT NULL DEFAULT now(), ip text, path text, referrer text, ua text, country text, region text, city text, is_bot boolean NOT NULL DEFAULT false, kind text NOT NULL CHECK (kind IN ('page','ai')), ai_route text)`);
      await db.query('CREATE INDEX IF NOT EXISTS visit_log_ts ON visit_log(ts)');
      await db.query('CREATE INDEX IF NOT EXISTS visit_log_ip_ts ON visit_log(ip,ts)');
    })();
    schemas.set(db, ready);
  }
  return ready;
}
const bot = /bot|crawler|spider|slurp|bingpreview|headless|lighthouse|pagespeed|vercel-screenshot|curl|wget|python-requests|go-http-client|axios|node-fetch|monitor|uptime|facebookexternalhit|preview/i;
export const isBot = (ua: string) => !ua || bot.test(ua);
export function shouldRecord(request: Request): boolean {
  const u = new URL(request.url), p = u.pathname;
  if (/^\/(?:_next(?:\/|$)|api\/(?:admin|cron)(?:\/|$)|manifest|favicon)/i.test(p) || /\.[a-z0-9]+$/i.test(p)) return false;
  if (request.method === 'POST') return /^\/api\/(interpret|heming)$/.test(p);
  if (request.method !== 'GET' || p.startsWith('/api/')) return false;
  return !request.headers.has('next-router-prefetch') && !request.headers.has('rsc') && !u.searchParams.has('_rsc') && !/prefetch/i.test(`${request.headers.get('purpose')} ${request.headers.get('sec-purpose')}`);
}
export function visitData(request: Request) {
  const h = request.headers;
  const ip = (h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || '').slice(0,64) || null;
  let referrer = '';
  try { const u = new URL(h.get('referer') || ''); if (/^https?:$/.test(u.protocol)) referrer = u.origin + u.pathname; } catch {}
  let city = h.get('x-vercel-ip-city') || ''; try { city = decodeURIComponent(city); } catch {}
  const ua = (h.get('user-agent') || '').slice(0,300);
  const path = new URL(request.url).pathname;
  return { ip, path, referrer, ua, country: h.get('x-vercel-ip-country')?.slice(0,100) || null, region: h.get('x-vercel-ip-country-region')?.slice(0,100) || null, city: city.slice(0,100), is_bot: isBot(h.get('user-agent') || ''), kind: request.method === 'POST' ? 'ai' : 'page', ai_route: request.method === 'POST' ? path.split('/').pop()! : null };
}
export async function recordVisit(request: Request, db = database()) {
  try {
    if (!db || !shouldRecord(request)) return;
    const d = visitData(request);
    if ((process.env.STATS_EXCLUDE_IPS || '').split(',').map(s => s.trim()).filter(Boolean).includes(d.ip || '')) return;
    await ensureSchema(db);
    await db.query('INSERT INTO visit_log (ip,path,referrer,ua,country,region,city,is_bot,kind,ai_route) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', Object.values(d));
  } catch { visitError(); }
}
export async function pruneVisits(db: Queryable) {
  await ensureSchema(db);
  const result = await db.query(`WITH deleted AS (DELETE FROM visit_log WHERE ts < now() - $1 * interval '1 day' RETURNING 1) SELECT count(*)::int AS rows FROM deleted`, [VISIT_RETENTION_DAYS]);
  const rows = result.rows[0].rows;
  syslog('info', 'visit.prune', { rows });
  return rows;
}
export async function visitStats(db: Queryable, days = 7, bots = false) {
  await ensureSchema(db);
  const filter = `ts >= now() - $1 * interval '1 day' AND ($2::boolean OR NOT is_bot)`;
  const run = async (sql: string) => (await db.query(`WITH v AS (SELECT * FROM visit_log WHERE ${filter}) ${sql}`, [days,bots])).rows;
  const counts = `count(*) FILTER (WHERE kind='page')::int AS pv, count(DISTINCT ip) FILTER (WHERE kind='page')::int AS uv, count(*) FILTER (WHERE kind='ai')::int AS "aiCalls"`;
  const totals = (await run(`SELECT ${counts}, count(DISTINCT ip) FILTER (WHERE kind='ai')::int AS "aiUv" FROM v`))[0];
  const daily = await run(`SELECT to_char(date_trunc('day', ts at time zone 'Asia/Hong_Kong'),'YYYY-MM-DD') AS day, ${counts} FROM v GROUP BY 1 ORDER BY 1`);
  const topPages = await run(`SELECT path, count(*)::int AS pv, count(DISTINCT ip)::int AS uv FROM v WHERE kind='page' GROUP BY path ORDER BY pv DESC, path LIMIT 20`);
  const topReferrers = await run(`SELECT host, count(*)::int AS pv FROM (SELECT CASE WHEN coalesce(referrer,'')='' THEN 'direct' ELSE lower(split_part(split_part(referrer,'://',2),'/',1)) END AS host FROM v WHERE kind='page') r WHERE host NOT IN ('tianjipan.tech','www.tianjipan.tech') AND host NOT LIKE '%.vercel.app' GROUP BY host ORDER BY pv DESC, host LIMIT 20`);
  const topIps = await run(`SELECT ip, ${counts.replace(/, count\(DISTINCT ip\) FILTER \(WHERE kind='page'\)::int AS uv/, '')}, max(country) AS country, max(city) AS city, max(ts) AS "lastSeen" FROM v GROUP BY ip ORDER BY pv DESC, "aiCalls" DESC LIMIT 30`);
  const topCountries = await run(`SELECT country, count(DISTINCT ip)::int AS uv FROM v WHERE kind='page' GROUP BY country ORDER BY uv DESC`);
  const aiByRoute = await run(`SELECT ai_route AS route, count(*)::int AS calls FROM v WHERE kind='ai' GROUP BY ai_route ORDER BY calls DESC`);
  const now = new Date();
  return { generatedAt: { iso: now.toISOString(), hkt: now.toLocaleString('sv-SE', { timeZone: 'Asia/Hong_Kong' }) + ' +08:00' }, days, timezone: 'Asia/Hong_Kong', totals, daily, topPages, topReferrers, topIps, topCountries, aiByRoute, enabled: true };
}
export function statsText(stats: Record<string, unknown>) {
  return Object.entries(stats).map(([key,value]) => `${key}:\n${Array.isArray(value) ? value.map(row => Object.entries(row).map(([k,v]) => `${k}=${v ?? '-'}`).join('\t')).join('\n') : typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n\n') + '\n';
}
