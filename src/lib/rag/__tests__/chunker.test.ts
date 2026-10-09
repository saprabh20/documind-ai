import { describe, it, expect } from 'vitest'
import { chunkPages } from '@/lib/rag/chunker'
import { RAG_CONFIG } from '@/lib/rag/config'
import type { ExtractedPage } from '@/types'

/** Generate text of approximately `tokens` tokens (1 token ≈ 4 chars). */
function makeText(tokens: number): string {
  const target = tokens * 4
  const word = 'word '  // 5 chars ≈ 1.25 tokens each
  return word.repeat(Math.ceil(target / word.length)).slice(0, target)
}

describe('chunkPages', () => {
  it('returns empty array for empty pages', () => {
    expect(chunkPages([])).toEqual([])
  })

  it('returns empty array when all pages have empty text', () => {
    const pages: ExtractedPage[] = [{ pageNumber: 1, text: '' }]
    expect(chunkPages(pages)).toEqual([])
  })

  it('returns a single chunk for short text under one chunk size', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: 'Short text.' }]
    const chunks = chunkPages(pages)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].content).toBe('Short text.')
    expect(chunks[0].pageNumber).toBeNull()
  })

  it('produces multiple chunks for long text', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: makeText(2000) }]
    const chunks = chunkPages(pages)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('chunks are approximately chunkSize tokens', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: makeText(2000) }]
    const chunks = chunkPages(pages)

    for (const chunk of chunks.slice(0, -1)) {
      // Allow ±20% tolerance due to char/token approximation
      expect(chunk.tokenCount).toBeLessThanOrEqual(RAG_CONFIG.chunkSize * 1.2)
    }
  })

  it('consecutive chunks overlap by approximately chunkOverlap tokens', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: makeText(2000) }]
    const chunks = chunkPages(pages)

    if (chunks.length < 2) return

    // Overlap means the end of chunk[i] should share content with the start of chunk[i+1]
    const c0 = chunks[0].content
    const c1 = chunks[1].content
    // At minimum, some portion of c0's end should appear in c1's start
    const overlapChars = RAG_CONFIG.chunkOverlap * 4
    const tailOfC0 = c0.slice(-overlapChars)
    expect(c1.slice(0, overlapChars * 2)).toContain(tailOfC0.slice(0, 20))
  })

  it('preserves page metadata for PDF pages', () => {
    const pages: ExtractedPage[] = [
      { pageNumber: 1, text: makeText(300) },
      { pageNumber: 2, text: makeText(300) },
    ]
    const chunks = chunkPages(pages)
    // All chunks should have a non-null page number
    for (const chunk of chunks) {
      expect(chunk.pageNumber).not.toBeNull()
    }
    // First chunk should come from page 1
    expect(chunks[0].pageNumber).toBe(1)
  })

  it('merges trailing chunk into previous when it is too small', () => {
    // Make text that produces a tiny trailing chunk
    const mainText = makeText(RAG_CONFIG.chunkSize * 2)
    // Append text that's well below minChunkTokens
    const tiny = 'tiny trailing content'   // ~5 tokens
    const pages: ExtractedPage[] = [{ pageNumber: null, text: mainText + ' ' + tiny }]

    const chunksWithTiny = chunkPages(pages)
    const pages2: ExtractedPage[] = [{ pageNumber: null, text: mainText }]
    const chunksWithout = chunkPages(pages2)

    // The count should be the same (tiny chunk merged into last)
    expect(chunksWithTiny.length).toBe(chunksWithout.length)
  })

  it('assigns sequential chunkIndex values starting at 0', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: makeText(2000) }]
    const chunks = chunkPages(pages)
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i)
    })
  })

  it('tokenCount is positive for every chunk', () => {
    const pages: ExtractedPage[] = [{ pageNumber: null, text: makeText(1000) }]
    const chunks = chunkPages(pages)
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0)
    }
  })
})
