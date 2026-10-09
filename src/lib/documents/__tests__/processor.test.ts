import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/documents/extractor', () => ({
  extractText: vi.fn(),
}))
vi.mock('@/lib/rag/chunker', () => ({
  chunkPages: vi.fn(),
}))
vi.mock('@/lib/gemini/embeddings', () => ({
  embedChunk: vi.fn(),
}))
vi.mock('@/lib/db/documents', () => ({
  insertDocument: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocumentChunkCount: vi.fn(),
}))
vi.mock('@/lib/db/chunks', () => ({
  insertChunk: vi.fn(),
}))

import { processDocument } from '@/lib/documents/processor'
import { extractText } from '@/lib/documents/extractor'
import { chunkPages } from '@/lib/rag/chunker'
import { embedChunk } from '@/lib/gemini/embeddings'
import {
  insertDocument,
  deleteDocument,
  updateDocumentChunkCount,
} from '@/lib/db/documents'
import { insertChunk } from '@/lib/db/chunks'

const FAKE_768 = Array.from({ length: 768 }, (_, i) => i / 768)

const FAKE_DOC = {
  id: 'doc-123',
  filename: 'test.txt',
  fileType: 'txt' as const,
  fileSizeBytes: 100,
  pageCount: null,
  chunkCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
}

const FAKE_PAGES = [{ pageNumber: null as null, text: 'hello world content here' }]

const FAKE_CHUNKS = [
  { content: 'hello world content here', pageNumber: null, tokenCount: 6, chunkIndex: 0 },
]

const FAKE_CHUNK_ROW = {
  id: 'chunk-1',
  documentId: 'doc-123',
  chunkIndex: 0,
  content: 'hello world content here',
  pageNumber: null,
  tokenCount: 6,
  createdAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.mocked(extractText).mockResolvedValue({ ok: true, pages: FAKE_PAGES })
  vi.mocked(chunkPages).mockReturnValue(FAKE_CHUNKS)
  vi.mocked(embedChunk).mockResolvedValue(FAKE_768)
  vi.mocked(insertDocument).mockResolvedValue(FAKE_DOC)
  vi.mocked(insertChunk).mockResolvedValue(FAKE_CHUNK_ROW)
  vi.mocked(updateDocumentChunkCount).mockResolvedValue(undefined)
  vi.mocked(deleteDocument).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('processDocument', () => {
  it('successfully ingests a document and returns it with correct chunk count', async () => {
    const buffer = Buffer.from('hello world content here')
    const result = await processDocument(buffer, 'test.txt', 'text/plain', 100)

    expect(insertDocument).toHaveBeenCalledOnce()
    expect(insertChunk).toHaveBeenCalledOnce()
    expect(updateDocumentChunkCount).toHaveBeenCalledWith('doc-123', 1, null)
    expect(result.chunkCount).toBe(1)
  })

  it('sets pageCount to null for TXT documents', async () => {
    // FAKE_PAGES has pageNumber: null — simulates TXT/MD extraction
    const buffer = Buffer.from('hello world content here')
    const result = await processDocument(buffer, 'test.txt', 'text/plain', 100)

    expect(updateDocumentChunkCount).toHaveBeenCalledWith('doc-123', 1, null)
    expect(result.pageCount).toBeNull()
  })

  it('sets pageCount to null for Markdown documents', async () => {
    const mdPages = [{ pageNumber: null as null, text: '# Heading\n\nSome markdown content.' }]
    vi.mocked(extractText).mockResolvedValue({ ok: true, pages: mdPages })

    const buffer = Buffer.from('# Heading\n\nSome markdown content.')
    const result = await processDocument(buffer, 'notes.md', 'text/markdown', 100)

    expect(updateDocumentChunkCount).toHaveBeenCalledWith('doc-123', 1, null)
    expect(result.pageCount).toBeNull()
  })

  it('sets pageCount to number of pages for PDF documents', async () => {
    const pdfPages = [
      { pageNumber: 1, text: 'Page one content.' },
      { pageNumber: 2, text: 'Page two content.' },
      { pageNumber: 3, text: 'Page three content.' },
    ]
    vi.mocked(extractText).mockResolvedValue({ ok: true, pages: pdfPages })
    vi.mocked(chunkPages).mockReturnValue([
      { content: 'Page one content. Page two content. Page three content.', pageNumber: 1, tokenCount: 12, chunkIndex: 0 },
    ])

    const buffer = Buffer.from('%PDF-1.4 ...')
    const result = await processDocument(buffer, 'report.pdf', 'application/pdf', 200)

    expect(updateDocumentChunkCount).toHaveBeenCalledWith('doc-123', 1, 3)
    expect(result.pageCount).toBe(3)
  })

  it('embeds each chunk with RETRIEVAL_DOCUMENT intent (embedChunk called per chunk)', async () => {
    const twoChunks = [
      { content: 'chunk one', pageNumber: null, tokenCount: 3, chunkIndex: 0 },
      { content: 'chunk two', pageNumber: null, tokenCount: 3, chunkIndex: 1 },
    ]
    vi.mocked(chunkPages).mockReturnValue(twoChunks)
    vi.mocked(insertChunk).mockResolvedValue(FAKE_CHUNK_ROW)

    const buffer = Buffer.from('chunk one chunk two')
    await processDocument(buffer, 'test.txt', 'text/plain', 100)

    expect(embedChunk).toHaveBeenCalledTimes(2)
  })

  it('deletes document row and rethrows on embedding failure', async () => {
    vi.mocked(embedChunk).mockRejectedValue(new Error('Embedding API down'))

    const buffer = Buffer.from('some content')
    await expect(
      processDocument(buffer, 'test.txt', 'text/plain', 100),
    ).rejects.toThrow('Document processing failed')

    expect(deleteDocument).toHaveBeenCalledWith('doc-123')
  })

  it('deletes document row and rethrows on DB insert chunk failure', async () => {
    vi.mocked(insertChunk).mockRejectedValue(new Error('DB write failed'))

    const buffer = Buffer.from('some content')
    await expect(
      processDocument(buffer, 'test.txt', 'text/plain', 100),
    ).rejects.toThrow('Document processing failed')

    expect(deleteDocument).toHaveBeenCalledWith('doc-123')
  })

  it('deletes document row and rethrows on extraction failure', async () => {
    vi.mocked(extractText).mockResolvedValue({ ok: false, error: 'Cannot read PDF' })

    const buffer = Buffer.from('%PDF-corrupt')
    await expect(
      processDocument(buffer, 'test.pdf', 'application/pdf', 100),
    ).rejects.toThrow('Document processing failed')

    expect(deleteDocument).toHaveBeenCalledWith('doc-123')
  })

  it('deletes document row when no chunks are produced', async () => {
    vi.mocked(chunkPages).mockReturnValue([])

    const buffer = Buffer.from(' ')
    await expect(
      processDocument(buffer, 'empty.txt', 'text/plain', 1),
    ).rejects.toThrow('Document processing failed')

    expect(deleteDocument).toHaveBeenCalledWith('doc-123')
  })
})
