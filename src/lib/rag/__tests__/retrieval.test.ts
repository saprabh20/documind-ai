import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/gemini/embeddings', () => ({
  embedQuery: vi.fn(),
}))

vi.mock('@/lib/db/chunks', () => ({
  retrieveSimilarChunks: vi.fn(),
}))

import { retrieveChunks } from '@/lib/rag/retrieval'
import { embedQuery } from '@/lib/gemini/embeddings'
import { retrieveSimilarChunks } from '@/lib/db/chunks'

const FAKE_768 = Array.from({ length: 768 }, (_, i) => i / 768)

const FAKE_CHUNK = {
  id: 'chunk-1',
  documentId: 'doc-1',
  chunkIndex: 0,
  content: 'Test content',
  pageNumber: 1,
  tokenCount: 10,
  createdAt: '2026-01-01T00:00:00Z',
  filename: 'test.pdf',
  fileType: 'pdf' as const,
  similarity: 0.85,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('retrieveChunks', () => {
  it('calls embedQuery (not embedChunk) with the question', async () => {
    vi.mocked(embedQuery).mockResolvedValue(FAKE_768)
    vi.mocked(retrieveSimilarChunks).mockResolvedValue([FAKE_CHUNK])

    await retrieveChunks('What is the capital?')

    expect(embedQuery).toHaveBeenCalledWith('What is the capital?')
  })

  it('returns chunks with similarity scores', async () => {
    vi.mocked(embedQuery).mockResolvedValue(FAKE_768)
    vi.mocked(retrieveSimilarChunks).mockResolvedValue([FAKE_CHUNK])

    const { chunks } = await retrieveChunks('test question')

    expect(chunks).toHaveLength(1)
    expect(chunks[0].similarity).toBe(0.85)
  })

  it('measures latencyMs', async () => {
    vi.mocked(embedQuery).mockResolvedValue(FAKE_768)
    vi.mocked(retrieveSimilarChunks).mockResolvedValue([FAKE_CHUNK])

    const { latencyMs } = await retrieveChunks('test question')

    expect(latencyMs).toBeGreaterThanOrEqual(0)
    expect(typeof latencyMs).toBe('number')
  })

  it('passes documentIds filter through', async () => {
    vi.mocked(embedQuery).mockResolvedValue(FAKE_768)
    vi.mocked(retrieveSimilarChunks).mockResolvedValue([])

    await retrieveChunks('question', {
      documentIds: ['doc-a', 'doc-b'],
    })

    expect(retrieveSimilarChunks).toHaveBeenCalledWith(
      FAKE_768,
      5,
      ['doc-a', 'doc-b'],
    )
  })

  it('returns empty array when no chunks match', async () => {
    vi.mocked(embedQuery).mockResolvedValue(FAKE_768)
    vi.mocked(retrieveSimilarChunks).mockResolvedValue([])

    const { chunks } = await retrieveChunks('unknown topic')

    expect(chunks).toEqual([])
  })

  it('throws when embedQuery returns wrong dimensions', async () => {
    vi.mocked(embedQuery).mockRejectedValue(
      new Error('Expected 768-dim embedding, got 512'),
    )

    await expect(retrieveChunks('test')).rejects.toThrow(/768/)
  })
})
