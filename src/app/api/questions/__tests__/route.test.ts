import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rag/pipeline', () => ({
  askQuestion: vi.fn(),
}))

import { POST } from '@/app/api/questions/route'
import { askQuestion } from '@/lib/rag/pipeline'

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
})

describe('POST /api/questions', () => {
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
