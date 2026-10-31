import { authorized } from '@/lib/stats-auth';
import { database, visitStats, statsText, visitError } from '@/lib/visitlog';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
export async function GET(request: Request) {
  if (!authorized(request, process.env.STATS_ADMIN_TOKEN)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const db = database();
  if (!db) return Response.json({ enabled: false, reason: 'DATABASE_URL not set' }, { headers });
  try {
    const p = new URL(request.url).searchParams;
    const days = Math.min(90, Math.max(1, Math.floor(Number(p.get('days')) || 7)));
    const stats = await visitStats(db, days, p.get('bots') === '1');
    return p.get('format') === 'text' ? new Response(statsText(stats), { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } }) : Response.json(stats, { headers });
  } catch { visitError(); return Response.json({ error: 'Statistics temporarily unavailable' }, { status: 503, headers }); }
}
