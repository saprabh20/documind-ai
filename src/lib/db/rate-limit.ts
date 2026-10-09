import { createHmac } from 'crypto'
import { getDb } from '@/lib/db/client'

// ============================================================
// Result type
// ============================================================

/**
 * Discriminated union returned by checkRateLimit.
 *
 *   allowed: true                      — request may proceed
 *   allowed: false, reason: exceeded   — 429 Too Many Requests
 *   allowed: false, reason: unavailable — 503 Service Unavailable
 *
 * The distinction matters: 'exceeded' is a normal rejection that the client
 * can act on; 'unavailable' means the rate-limit infrastructure itself is
 * broken and we fail CLOSED to protect free-tier Gemini quota.
 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'exceeded' | 'unavailable' }

// ============================================================
// Rate limit check
// ============================================================

/**
 * Checks and increments the request count for a client key + endpoint in the
 * current fixed time window.
 *
 * Fixed-window boundary note: a client can burst up to 2× the limit by
 * sending `limit` requests at the end of one window and `limit` requests at
 * the start of the next. For a 5-request portfolio limit this means at most
 * 10 requests in a short burst at a boundary — acceptable for this use case.
 *
 * Fails CLOSED on DB error — if the rate-limit table is unavailable the
 * request is rejected (503) rather than allowed through to Gemini. This
 * protects free-tier quota during brief infrastructure failures.
 *
 * @param clientKey HMAC digest from computeClientKey() — never a raw IP.
 * @param endpoint  Short identifier for the route, e.g. 'questions'.
 * @param limit     Maximum requests allowed per window.
 * @param windowMs  Window duration in ms (default 60 000 = 1 minute).
 */
export async function checkRateLimit(
  clientKey: string,
  endpoint: string,
  limit: number,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  try {
    const db = getDb()

    // Round current time down to the window boundary (fixed-window counter).
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()

    const { data, error } = await db.rpc('increment_rate_limit', {
      p_client_key: clientKey,
      p_endpoint: endpoint,
      p_window_start: windowStart,
    })

    if (error) {
      // Fail closed — protect Gemini quota on infrastructure failure.
      console.error('[rate-limit] RPC error:', error.message)
      return { allowed: false, reason: 'unavailable' }
    }

    const count = data as number
    return count <= limit
      ? { allowed: true }
      : { allowed: false, reason: 'exceeded' }
  } catch {
    // Fail closed on unexpected errors (network timeout, etc.).
    return { allowed: false, reason: 'unavailable' }
  }
}

// ============================================================
// Client key — HMAC pseudonym
// ============================================================

/**
 * Computes a pseudonymous client key as HMAC-SHA-256(ip, secret).
 *
 * Why not plain SHA-256(IP)?
 *   IPv4 covers only ~4 billion addresses — a small, enumerable space.
 *   A dictionary attack could reverse any plain hash in seconds. HMAC with a
 *   server-only secret makes the digest non-reversible without that secret,
 *   even under a full IPv4 enumeration.
 *
 * The secret is RATE_LIMIT_SECRET from the server environment, validated by
 * parseEnv() before this function is called. It is never sent to the browser.
 *
 * @param ip     Raw IP string from getClientIp().
 * @param secret RATE_LIMIT_SECRET — a long, randomly generated server secret.
 * @returns      64-character lowercase hex HMAC digest.
 */
export function computeClientKey(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex')
}

// ============================================================
// Client IP extraction
// ============================================================

/**
 * Extracts the client IP from a Next.js Request object.
 *
 * Trust model on Vercel (direct deployment, no additional proxy):
 *   - x-real-ip: set by Vercel's edge to the verified client IP. This is the
 *     canonical single-value header. Clients cannot inject a different value
 *     because Vercel's infrastructure sets it unconditionally.
 *   - x-forwarded-for: also overwritten by Vercel for direct deployments.
 *     Used as a fallback; the first entry is Vercel's value. If a proxy sits
 *     in front of Vercel, prefer x-real-ip (unchanged by the proxy) or
 *     switch to x-vercel-forwarded-for.
 *   - local-dev: stable fallback when neither header is present (e.g., running
 *     `next dev` without a reverse proxy). Rate limiting still works in this
 *     mode — all local requests share the 'local-dev' key.
 *
 * The returned string is passed to computeClientKey() and HMAC-hashed before
 * reaching the database. The raw IP is never stored.
 */
export function getClientIp(request: Request): string {
  // Vercel sets x-real-ip to the verified client IP — prefer it as the
  // single canonical source that requires no splitting.
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  // Fallback: x-forwarded-for overwritten by Vercel for direct deployments.
  // Take the first entry; search_path is pinned so resolution is deterministic.
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  // Local development without a proxy — stable fallback for testability.
  return 'local-dev'
}
