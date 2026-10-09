import { RAG_CONFIG } from '@/lib/rag/config'
import type { ExtractedPage, TextChunk } from '@/types'

function countTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Splits extracted pages into overlapping text chunks using a sliding window.
 *
 * Pages are concatenated with a newline delimiter, with page boundary offsets
 * tracked so each chunk inherits the correct page number.
 */
export function chunkPages(pages: ExtractedPage[]): TextChunk[] {
  if (pages.length === 0) return []

  // Build a single flat text and track character offsets for each page start.
  const pageStarts: Array<{ charOffset: number; pageNumber: number | null }> = []
  let flat = ''
  for (const page of pages) {
    pageStarts.push({ charOffset: flat.length, pageNumber: page.pageNumber })
    if (flat.length > 0) flat += '\n'
    flat += page.text
  }

  if (flat.trim().length === 0) return []

  const { chunkSize, chunkOverlap, minChunkTokens } = RAG_CONFIG
  const step = chunkSize - chunkOverlap

  // Character-level approximation: 1 token ≈ 4 chars
  const charsPerChunk = chunkSize * 4
  const charsPerStep = step * 4

  const rawChunks: Array<{ content: string; startChar: number }> = []

  let startChar = 0
  while (startChar < flat.length) {
    const endChar = Math.min(startChar + charsPerChunk, flat.length)
    const content = flat.slice(startChar, endChar).trim()
    if (content.length > 0) {
      rawChunks.push({ content, startChar })
    }
    if (endChar >= flat.length) break
    startChar += charsPerStep
  }

  if (rawChunks.length === 0) return []

  // Merge final chunk into previous if it's too small
  if (rawChunks.length > 1) {
    const last = rawChunks[rawChunks.length - 1]
    if (countTokens(last.content) < minChunkTokens) {
      const prev = rawChunks[rawChunks.length - 2]
      prev.content = (prev.content + '\n' + last.content).trim()
      rawChunks.pop()
    }
  }

  // Resolve page numbers: a chunk belongs to the page where its start char falls
  const resolvePageNumber = (startChar: number): number | null => {
    // Find the last page whose start offset is ≤ startChar
    let resolved: number | null = null
    for (const ps of pageStarts) {
      if (ps.charOffset <= startChar) {
        resolved = ps.pageNumber
      }
    }
    return resolved
  }

  return rawChunks.map((rc, index) => ({
    content: rc.content,
    pageNumber: resolvePageNumber(rc.startChar),
    tokenCount: countTokens(rc.content),
    chunkIndex: index,
  }))
}
