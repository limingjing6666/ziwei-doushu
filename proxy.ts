import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { recordVisit, shouldRecord } from './lib/visitlog';
export function proxy(request: NextRequest, event: NextFetchEvent) {
  try { if (shouldRecord(request)) event.waitUntil(recordVisit(request)); } catch { /* Logging must never affect routing. */ }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/|api/admin|api/cron|robots\\.txt|sitemap\\.xml|manifest|favicon|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|css|js|map|txt|xml|woff2?|ttf|json|pdf)$).*)'] };
