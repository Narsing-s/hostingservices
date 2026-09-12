import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyInternalSecret(value: string | undefined): boolean {
  const secret = process.env.ENGINE_INTERNAL_SECRET;
  if (!secret || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(createHmac('sha256', secret).update('nexus-engine').digest('hex'));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function internalAuthHeader(): string {
  const secret = process.env.ENGINE_INTERNAL_SECRET;
  if (!secret) throw new Error('ENGINE_INTERNAL_SECRET is required');
  return createHmac('sha256', secret).update('nexus-engine').digest('hex');
}
