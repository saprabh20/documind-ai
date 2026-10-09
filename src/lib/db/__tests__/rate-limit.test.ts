import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock the DB client before importing the module under test.
vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn(),
}))

import { computeClientKey, getClientIp, checkRateLimit } from '@/lib/db/rate-limit'
import { getDb } from '@/lib/db/client'

// ============================================================
// Helpers
// ============================================================

const SECRET = 'a'.repeat(32) // 32-char test secret — meets minimum length

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/questions', {
    method: 'POST',
    headers,
  })
}

function makeMockDb(rpcResult: { data: unknown; error: null | { message: string } }) {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) }
}

afterEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// computeClientKey — HMAC pseudonymisation
// ============================================================

describe('computeClientKey', () => {
  it('produces the same 64-char hex digest for the same ip and secret', () => {
    const k1 = computeClientKey('203.0.113.1', SECRET)
    const k2 = computeClientKey('203.0.113.1', SECRET)
    expect(k1).toBe(k2)
    expect(k1).toHaveLength(64)
    expect(k1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces a different digest for a different IP', () => {
    const k1 = computeClientKey('203.0.113.1', SECRET)
    const k2 = computeClientKey('203.0.113.2', SECRET)
    expect(k1).not.toBe(k2)
  })

  it('produces a different digest for the same IP with a different secret', () => {
    const k1 = computeClientKey('203.0.113.1', SECRET)
    const k2 = computeClientKey('203.0.113.1', 'b'.repeat(32))
    expect(k1).not.toBe(k2)
  })

  it('output is always 64 hex characters regardless of input length', () => {
    expect(computeClientKey('1.1.1.1', SECRET)).toHaveLength(64)
    expect(computeClientKey('2001:db8::1', SECRET)).toHaveLength(64)
    expect(computeClientKey('local-dev', SECRET)).toHaveLength(64)
  })
})

// ============================================================
// getClientIp — Vercel header trust model
// ============================================================

describe('getClientIp', () => {
  it('returns x-real-ip when present', () => {
    const req = makeRequest({ 'x-real-ip': '203.0.113.42' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('x-real-ip takes priority over x-forwarded-for', () => {
    // Simulates the Vercel scenario: x-real-ip is Vercel-verified; any value
    // in x-forwarded-for is ignored when x-real-ip is present.
    const req = makeRequest({
      'x-real-ip': '203.0.113.42',
      'x-forwarded-for': '1.2.3.4',   // attacker-controlled or proxy-injected
    })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('falls back to first entry of x-forwarded-for when x-real-ip is absent', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.42, 10.0.0.1' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('trims whitespace from x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '  203.0.113.42  ' })
    expect(getClientIp(req)).toBe('203.0.113.42')
  })

  it('returns local-dev when no IP headers are present', () => {
    const req = makeRequest()
    expect(getClientIp(req)).toBe('local-dev')
  })

  it('local-dev is stable across multiple calls with no headers', () => {
    expect(getClientIp(makeRequest())).toBe(getClientIp(makeRequest()))
  })
})

// ============================================================
// checkRateLimit — DB interaction and result discrimination
// ============================================================

describe('checkRateLimit', () => {
  it('returns allowed:true when count is within the limit', async () => {
    vi.mocked(getDb).mockReturnValue(makeMockDb({ data: 3, error: null }) as never)

    const result = await checkRateLimit('key', 'questions', 5)
    expect(result).toEqual({ allowed: true })
  })

  it('returns allowed:true when count equals the limit exactly', async () => {
    vi.mocked(getDb).mockReturnValue(makeMockDb({ data: 5, error: null }) as never)

    const result = await checkRateLimit('key', 'questions', 5)
    expect(result).toEqual({ allowed: true })
  })

  it('returns allowed:false reason:exceeded when count exceeds the limit', async () => {
    vi.mocked(getDb).mockReturnValue(makeMockDb({ data: 6, error: null }) as never)

    const result = await checkRateLimit('key', 'questions', 5)
    expect(result).toEqual({ allowed: false, reason: 'exceeded' })
  })

  it('5 requests are allowed and the 6th is rejected', async () => {
    let callCount = 0
    const db = {
      rpc: vi.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ data: callCount, error: null })
      }),
    }
    vi.mocked(getDb).mockReturnValue(db as never)

    const results = await Promise.all(
      Array.from({ length: 6 }, () => checkRateLimit('key', 'questions', 5)),
    )

    const allowed = results.filter(r => r.allowed)
    const rejected = results.filter(r => !r.allowed)

    expect(allowed).toHaveLength(5)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toEqual({ allowed: false, reason: 'exceeded' })
  })

  it('returns allowed:false reason:unavailable on RPC error', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeMockDb({ data: null, error: { message: 'relation does not exist' } }) as never,
    )

    const result = await checkRateLimit('key', 'questions', 5)
    expect(result).toEqual({ allowed: false, reason: 'unavailable' })
  })

  it('returns allowed:false reason:unavailable when getDb throws', async () => {
    vi.mocked(getDb).mockImplementation(() => {
      throw new Error('DB connection failed')
    })

    const result = await checkRateLimit('key', 'questions', 5)
    expect(result).toEqual({ allowed: false, reason: 'unavailable' })
  })

  it('passes the client key to the RPC — never a raw IP', async () => {
    const db = makeMockDb({ data: 1, error: null })
    vi.mocked(getDb).mockReturnValue(db as never)

    const clientKey = computeClientKey('203.0.113.1', SECRET)
    await checkRateLimit(clientKey, 'questions', 5)

    expect(db.rpc).toHaveBeenCalledWith('increment_rate_limit', expect.objectContaining({
      p_client_key: clientKey,
    }))

    // The raw IP must not appear in the RPC call arguments.
    const callArgs = db.rpc.mock.calls[0][1]
    expect(JSON.stringify(callArgs)).not.toContain('203.0.113.1')
  })
})
