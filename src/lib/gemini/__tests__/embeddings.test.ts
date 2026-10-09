import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the Gemini client module before importing the module under test
vi.mock('@/lib/gemini/client', () => ({
  getGemini: vi.fn(),
}))

import { embedChunk, embedQuery } from '@/lib/gemini/embeddings'
import { getGemini } from '@/lib/gemini/client'

const FAKE_768 = Array.from({ length: 768 }, (_, i) => i / 768)

function makeFakeGemini(embeddingValues: number[] = FAKE_768) {
  return {
    models: {
      embedContent: vi.fn().mockResolvedValue({
        embeddings: [{ values: embeddingValues }],
      }),
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('embedChunk', () => {
  it('returns a 768-dimensional embedding', async () => {
    const fakeGemini = makeFakeGemini()
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    const result = await embedChunk('test content')
    expect(result).toHaveLength(768)
  })

  it('calls the model with RETRIEVAL_DOCUMENT taskType', async () => {
    const fakeGemini = makeFakeGemini()
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    await embedChunk('hello world')

    expect(fakeGemini.models.embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ taskType: 'RETRIEVAL_DOCUMENT' }),
      }),
    )
  })

  it('uses outputDimensionality 768', async () => {
    const fakeGemini = makeFakeGemini()
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    await embedChunk('hello')

    expect(fakeGemini.models.embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ outputDimensionality: 768 }),
      }),
    )
  })

  it('throws if the embedding has wrong dimensions', async () => {
    const wrong = Array.from({ length: 512 }, () => 0)
    const fakeGemini = makeFakeGemini(wrong)
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    await expect(embedChunk('test')).rejects.toThrow(/768/)
  })

  it('retries on 429 rate limit error and eventually succeeds', async () => {
    const fakeGemini = {
      models: {
        embedContent: vi
          .fn()
          .mockRejectedValueOnce(new Error('HTTP 429 Too Many Requests'))
          .mockResolvedValueOnce({ embeddings: [{ values: FAKE_768 }] }),
      },
    }
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    const resultPromise = embedChunk('test')
    // Advance timers past the backoff delay
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toHaveLength(768)
    expect(fakeGemini.models.embedContent).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-429 errors', async () => {
    const fakeGemini = {
      models: {
        embedContent: vi.fn().mockRejectedValue(new Error('Authentication failed')),
      },
    }
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    await expect(embedChunk('test')).rejects.toThrow('Authentication failed')
    expect(fakeGemini.models.embedContent).toHaveBeenCalledTimes(1)
  })
})

describe('embedQuery', () => {
  it('returns a 768-dimensional embedding', async () => {
    const fakeGemini = makeFakeGemini()
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    const result = await embedQuery('what is the capital?')
    expect(result).toHaveLength(768)
  })

  it('calls the model with RETRIEVAL_QUERY taskType', async () => {
    const fakeGemini = makeFakeGemini()
    vi.mocked(getGemini).mockReturnValue(fakeGemini as never)

    await embedQuery('test question')

    expect(fakeGemini.models.embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ taskType: 'RETRIEVAL_QUERY' }),
      }),
    )
  })
})
