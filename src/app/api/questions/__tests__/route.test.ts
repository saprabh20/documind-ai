import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rag/pipeline', () => ({
  askQuestion: vi.fn(),
}))

vi.mock('@/lib/db/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  computeClientKey: vi.fn().mockReturnValue('mock-client-key'),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/env', () => ({
  parseEnv: vi.fn().mockReturnValue({
    GEMINI_API_KEY: 'fake',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
    GEMINI_GENERATION_MODEL: 'gemini-3.8-flash',
    NEXT_PUBLIC_SUPABASE_URL: 'https://fake.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
    ENABLE_UPLOAD: 'true' as const,
    ENABLE_DELETE: 'true' as const,
    RATE_LIMIT_SECRET: 'a'.repeat(32),
  }),
}))

import { POST } from '@/app/api/questions/route'
import { askQuestion } from '@/lib/rag/pipeline'
import { checkRateLimit } from '@/lib/db/rate-limit'

const FAKE_RESULT = {
  answer: 'Paris is the capital.',
  citations: [
    {
      chunkId: 'chunk-1',
      filename: 'report.pdf',
      fileType: 'pdf' as const,
      pageNumber: 3,
      passage: 'Paris is the capital of France.',
      similarity: 0.92,
    },
  ],
  retrieval: { chunksRetrieved: 5, latencyMs: 150 },
  cannotAnswer: false,
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.clearAllMocks()
  // Reset rate limit mock to allow by default after each test.
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true })
})

describe('POST /api/questions — rate limiting', () => {
  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, reason: 'exceeded' })

    const response = await POST(makeRequest({ question: 'test?' }))
    expect(response.status).toBe(429)

    const body = await response.json()
    expect(body.error).toMatch(/too many requests/i)
  })

  it('returns 503 and does not call Gemini when rate-limit DB is unavailable', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, reason: 'unavailable' })

    const response = await POST(makeRequest({ question: 'test?' }))
    expect(response.status).toBe(503)

    // Must not reach Gemini — quota is protected.
    expect(askQuestion).not.toHaveBeenCalled()

    const body = await response.json()
    expect(body.error).toMatch(/temporarily unavailable/i)
  })

  it('503 from rate-limit failure does not expose the DB error', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, reason: 'unavailable' })

    const response = await POST(makeRequest({ question: 'test?' }))
    const body = await response.json()

    // Safe message — no DB internals.
    expect(body.error).not.toMatch(/relation|supabase|rpc|sql/i)
  })

  it('5 requests within limit are allowed (mocked sequential calls)', async () => {
    vi.mocked(askQuestion).mockResolvedValue(FAKE_RESULT)

    // Five consecutive allowed checks all go through to Gemini.
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ question: 'What is this?' }))
      expect(response.status).toBe(200)
    }

    expect(askQuestion).toHaveBeenCalledTimes(5)
  })

  it('6th request is rejected with 429 (mocked exceeded)', async () => {
    vi.mocked(askQuestion).mockResolvedValue(FAKE_RESULT)

    // First 5 allowed.
    for (let i = 0; i < 5; i++) {
      vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true })
    }
    // 6th exceeds limit.
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, reason: 'exceeded' })

    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest({ question: 'test?' }))
      expect(response.status).toBe(200)
    }
    const sixth = await POST(makeRequest({ question: 'test?' }))
    expect(sixth.status).toBe(429)
    expect(askQuestion).toHaveBeenCalledTimes(5) // not called on the 6th
  })
})

describe('POST /api/questions — input validation', () => {
  it('returns 400 for empty question', async () => {
    const response = await POST(makeRequest({ question: '' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 for whitespace-only question', async () => {
    const response = await POST(makeRequest({ question: '   ' }))
    expect(response.status).toBe(400)
  })

  it('returns 400 for question too long', async () => {
    const longQuestion = 'a'.repeat(1001)
    const response = await POST(makeRequest({ question: longQuestion }))
    expect(response.status).toBe(400)
  })

  it('returns 400 for invalid UUID in documentIds', async () => {
    const response = await POST(
      makeRequest({ question: 'test?', documentIds: ['not-a-uuid'] }),
    )
    expect(response.status).toBe(400)
  })
})

describe('POST /api/questions — successful responses', () => {
  it('returns 200 with valid request', async () => {
    vi.mocked(askQuestion).mockResolvedValue(FAKE_RESULT)

    const response = await POST(makeRequest({ question: 'What is the capital?' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.answer).toBe('Paris is the capital.')
    expect(body.citations).toHaveLength(1)
  })

  it('returns 200 with cannotAnswer flag when pipeline says so', async () => {
    vi.mocked(askQuestion).mockResolvedValue({
      ...FAKE_RESULT,
      cannotAnswer: true,
      citations: [],
    })

    const response = await POST(makeRequest({ question: 'unanswerable?' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.cannotAnswer).toBe(true)
  })
})

describe('POST /api/questions — error handling', () => {
  it('returns 503 when Gemini is unavailable after retries', async () => {
    vi.mocked(askQuestion).mockRejectedValue(
      new Error('Generation failed after 3 retries: HTTP 503'),
    )

    const response = await POST(makeRequest({ question: 'test?' }))
    expect(response.status).toBe(503)
  })

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(askQuestion).mockRejectedValue(new Error('Something broke'))

    const response = await POST(makeRequest({ question: 'test?' }))
    expect(response.status).toBe(500)

    const body = await response.json()
    // Must not expose internal error details
    expect(body.error).not.toContain('Something broke')
  })
})
