import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/rag/retrieval', () => ({
  retrieveChunks: vi.fn(),
}))

vi.mock('@/lib/gemini/generation', () => ({
  generateAnswer: vi.fn(),
}))

import { askQuestion } from '@/lib/rag/pipeline'
import { retrieveChunks } from '@/lib/rag/retrieval'
import { generateAnswer } from '@/lib/gemini/generation'
import type { DocumentChunkWithSource } from '@/types'

const CHUNK_1: DocumentChunkWithSource = {
  id: 'chunk-1',
  documentId: 'doc-1',
  chunkIndex: 0,
  content: 'Paris is the capital of France.',
  pageNumber: 3,
  tokenCount: 8,
  createdAt: '2026-01-01T00:00:00Z',
  filename: 'report.pdf',
  fileType: 'pdf',
  similarity: 0.92,
}

const CHUNK_2: DocumentChunkWithSource = {
  id: 'chunk-2',
  documentId: 'doc-1',
  chunkIndex: 1,
  content: 'France is in Western Europe.',
  pageNumber: 5,
  tokenCount: 7,
  createdAt: '2026-01-01T00:00:00Z',
  filename: 'report.pdf',
  fileType: 'pdf',
  similarity: 0.78,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('askQuestion', () => {
  it('returns a grounded answer with validated citations', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1, CHUNK_2],
      latencyMs: 150,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Paris is the capital [SOURCE_1].',
      citedSourceIds: ['SOURCE_1'],
      cannotAnswer: false,
    })

    const result = await askQuestion('What is the capital of France?')

    expect(result.answer).toContain('Paris')
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].chunkId).toBe('chunk-1')
    expect(result.cannotAnswer).toBe(false)
    expect(result.retrieval.chunksRetrieved).toBe(2)
  })

  it('includes cited SOURCE_1 when it exists in retrieved chunks', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1],
      latencyMs: 100,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Paris.',
      citedSourceIds: ['SOURCE_1'],
      cannotAnswer: false,
    })

    const result = await askQuestion('Capital?')

    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].chunkId).toBe('chunk-1')
  })

  it('strips cited SOURCE_99 that does not exist in retrieved set', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1],
      latencyMs: 100,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Some answer.',
      citedSourceIds: ['SOURCE_99'],
      cannotAnswer: false,
    })

    const result = await askQuestion('test?')

    expect(result.citations).toHaveLength(0)
    // Answer is still returned even with no valid citations
    expect(result.answer).toBe('Some answer.')
  })

  it('uses citation metadata from retrieved chunks, not model output', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1],
      latencyMs: 100,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Answer.',
      citedSourceIds: ['SOURCE_1'],
      cannotAnswer: false,
    })

    const result = await askQuestion('test?')

    expect(result.citations[0].filename).toBe('report.pdf')
    expect(result.citations[0].pageNumber).toBe(3)
    expect(result.citations[0].similarity).toBe(0.92)
    expect(result.citations[0].fileType).toBe('pdf')
  })

  it('returns cannotAnswer when no chunks are retrieved', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [],
      latencyMs: 50,
    })

    const result = await askQuestion('No context question?')

    expect(result.cannotAnswer).toBe(true)
    expect(result.citations).toEqual([])
    // generateAnswer should NOT be called
    expect(generateAnswer).not.toHaveBeenCalled()
  })

  it('returns cannotAnswer when model says CANNOT_ANSWER', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1],
      latencyMs: 100,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: '',
      citedSourceIds: [],
      cannotAnswer: true,
    })

    const result = await askQuestion('Unanswerable question?')

    expect(result.cannotAnswer).toBe(true)
    expect(result.citations).toEqual([])
  })

  it('handles multiple valid citations', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1, CHUNK_2],
      latencyMs: 120,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Combined answer.',
      citedSourceIds: ['SOURCE_1', 'SOURCE_2'],
      cannotAnswer: false,
    })

    const result = await askQuestion('test?')

    expect(result.citations).toHaveLength(2)
    expect(result.citations[0].chunkId).toBe('chunk-1')
    expect(result.citations[1].chunkId).toBe('chunk-2')
  })

  it('returns answer with empty citations when all citations are invalid', async () => {
    vi.mocked(retrieveChunks).mockResolvedValue({
      chunks: [CHUNK_1],
      latencyMs: 100,
    })
    vi.mocked(generateAnswer).mockResolvedValue({
      answer: 'Some answer with fake citations.',
      citedSourceIds: ['SOURCE_50', 'SOURCE_99'],
      cannotAnswer: false,
    })

    const result = await askQuestion('test?')

    expect(result.citations).toEqual([])
    expect(result.answer).toBe('Some answer with fake citations.')
    expect(result.cannotAnswer).toBe(false)
  })
})
