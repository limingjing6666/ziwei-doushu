import { authorized } from '@/lib/stats-auth';
import { database, visitStats, statsText, visitError } from '@/lib/visitlog';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
export async function GET(request: Request) {
  if (!authorized(request, process.env.STATS_ADMIN_TOKEN)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const p = new URL(request.url).searchParams;
  const respond = (data: Record<string, unknown>) => p.get('format') === 'text' ? new Response(statsText(data), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } }) : Response.json(data, { headers });
  const db = database();
  if (!db) return respond({ enabled: false, reason: 'DATABASE_URL not set' });
  try {
    const days = Math.min(90, Math.max(1, Math.floor(Number(p.get('days')) || 7)));
    const stats = await visitStats(db, days, p.get('bots') === '1', new URL(request.url).host);
    return respond(stats);
  } catch { visitError(); return Response.json({ error: 'Statistics temporarily unavailable' }, { status: 503, headers }); }
}
