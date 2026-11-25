import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const secure = process.env.NODE_ENV === 'production';
const cookieName = secure ? '__Host-tianjipan-model-admin' : 'tianjipan-model-admin';
const lifetimeSeconds = 12 * 60 * 60;

export function adminLoginConfigured(): boolean {
  return Boolean(process.env.MODEL_ADMIN_PASSWORD);
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function signature(password: string, payload: string) {
  return createHmac('sha256', password).update(payload).digest('base64url');
}

export async function adminSignedIn(): Promise<boolean> {
  const password = process.env.MODEL_ADMIN_PASSWORD;
  if (!password) return false;
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return false;
  const [expiry, nonce, proof, extra] = value.split('.');
  if (!proof || extra !== undefined || !/^\d+$/.test(expiry) || !nonce || Number(expiry) <= Date.now()) return false;
  return timingSafeEqual(digest(proof), digest(signature(password, expiry + '.' + nonce)));
}

export async function startAdminSession(candidate: FormDataEntryValue | null): Promise<boolean> {
  const password = process.env.MODEL_ADMIN_PASSWORD;
  if (!password || typeof candidate !== 'string' || !timingSafeEqual(digest(password), digest(candidate))) return false;
  const payload = (Date.now() + lifetimeSeconds * 1000) + '.' + randomBytes(18).toString('base64url');
  (await cookies()).set(cookieName, payload + '.' + signature(password, payload), {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: lifetimeSeconds,
  });
  return true;
}

export async function endAdminSession() {
  (await cookies()).set(cookieName, '', { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 0 });
}
