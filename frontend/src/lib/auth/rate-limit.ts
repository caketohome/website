/**
 * Per-instance fixed-window limiter in front of Supabase's own OTP limits.
 * Caps SMS cost/abuse from one IP or against one number. Not shared across instances;
 * Supabase Auth rate limits remain the global backstop.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function takeToken(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (hits.size > 10_000) {
    hits.forEach((v, k) => { if (v.resetAt < now) hits.delete(k); });
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  return entry.count <= limit
    ? { ok: true, retryAfter: 0 }
    : { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}
