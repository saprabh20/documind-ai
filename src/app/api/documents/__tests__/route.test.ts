import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', () => ({
  parseEnv: vi.fn(),
}))
vi.mock('@/lib/documents/processor', () => ({
  processDocument: vi.fn(),
}))
vi.mock('@/lib/db/documents', () => ({
  listDocuments: vi.fn(),
}))

import { GET, POST } from '@/app/api/documents/route'
import { parseEnv } from '@/lib/env'
import { processDocument } from '@/lib/documents/processor'
import { listDocuments } from '@/lib/db/documents'

const FAKE_DOC = {
  id: 'doc-123',
  filename: 'test.txt',
  fileType: 'txt' as const,
  fileSizeBytes: 100,
  pageCount: null,
  chunkCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
}

const BASE_ENV = {
  GEMINI_API_KEY: 'fake',
  GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
  GEMINI_GENERATION_MODEL: 'gemini-2.5-flash',
  NEXT_PUBLIC_SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
  ENABLE_UPLOAD: 'true' as const,
  ENABLE_DELETE: 'true' as const,
}

function makeRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost/api/documents', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => {
  vi.mocked(parseEnv).mockReturnValue(BASE_ENV)
  vi.mocked(listDocuments).mockResolvedValue([FAKE_DOC])
  vi.mocked(processDocument).mockResolvedValue(FAKE_DOC)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/documents', () => {
  it('returns 200 with list of documents', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('doc-123')
  })
})

describe('POST /api/documents', () => {
  it('returns 403 when uploads are disabled', async () => {
    vi.mocked(parseEnv).mockReturnValue({ ...BASE_ENV, ENABLE_UPLOAD: 'false' })

    const fd = new FormData()
    fd.append('file', new File(['content'], 'test.txt', { type: 'text/plain' }))
    const response = await POST(makeRequest(fd))

    expect(response.status).toBe(403)
  })

  it('returns 400 when no file is provided', async () => {
    const fd = new FormData()
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(400)
  })

  it('returns 400 for unsupported file extension', async () => {
    const fd = new FormData()
    fd.append('file', new File(['content'], 'doc.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('extension')
  })

  it('returns 400 for unsupported MIME type', async () => {
    const fd = new FormData()
    // Extension is .txt but MIME type is wrong
    fd.append('file', new File(['content'], 'test.txt', { type: 'application/octet-stream' }))
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('MIME type')
  })

  it('returns 400 for empty file', async () => {
    const fd = new FormData()
    fd.append('file', new File([], 'empty.txt', { type: 'text/plain' }))
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('empty')
  })

  it('returns 400 for oversized file', async () => {
    const big = new Uint8Array(5 * 1024 * 1024)
    const fd = new FormData()
    fd.append('file', new File([big], 'big.txt', { type: 'text/plain' }))
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('too large')
  })

  it('returns 201 with document on successful upload', async () => {
    const fd = new FormData()
    fd.append('file', new File(['hello world content'], 'test.txt', { type: 'text/plain' }))
    const response = await POST(makeRequest(fd))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.document.id).toBe('doc-123')
    expect(body.chunksCreated).toBe(3)
  })
})
