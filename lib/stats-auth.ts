import { createHash, timingSafeEqual } from 'node:crypto';
export function authorized(request: Request, secret: string | undefined) {
  const supplied = request.headers.get('authorization') || '';
  const hash = (s: string) => createHash('sha256').update(s).digest();
  const match = timingSafeEqual(hash(supplied), hash(`Bearer ${secret || ''}`));
  return Boolean(secret) && match;
}
