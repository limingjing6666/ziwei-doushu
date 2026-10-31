import { parseArgs } from 'node:util';
try {
  const { values } = parseArgs({ options: { days: { type: 'string', default: '7' }, url: { type: 'string' }, token: { type: 'string' } } });
  const base = values.url || process.env.STATS_URL;
  const token = values.token || process.env.STATS_ADMIN_TOKEN;
  if (!base || !token) throw new Error();
  const url = new URL('/api/admin/stats', base);
  url.searchParams.set('days', values.days); url.searchParams.set('format', 'text');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' });
  if (!response.ok) { console.error(`统计请求失败 (HTTP ${response.status})`); process.exitCode = 1; }
  else console.log(await response.text());
} catch { console.error('请检查 --url/--token（或 STATS_URL/STATS_ADMIN_TOKEN）与网络连接。'); process.exitCode = 1; }
