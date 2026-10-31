import { authorized } from '@/lib/stats-auth';
import { database, pruneVisits, visitError } from '@/lib/visitlog';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (!authorized(request, process.env.CRON_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  const db = database();
  if (!db) return Response.json({ enabled: false }, { headers });
  try { return Response.json({ rows: await pruneVisits(db) }, { headers }); }
  catch { visitError(); return Response.json({ error: 'Prune temporarily unavailable' }, { status: 503, headers }); }
}
