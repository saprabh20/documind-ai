import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', () => ({
  parseEnv: vi.fn(),
}))
vi.mock('@/lib/db/documents', () => ({
  deleteDocument: vi.fn(),
}))

import { DELETE } from '@/app/api/documents/[id]/route'
import { parseEnv } from '@/lib/env'
import { deleteDocument } from '@/lib/db/documents'

const BASE_ENV = {
  GEMINI_API_KEY: 'fake',
  GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
  GEMINI_GENERATION_MODEL: 'gemini-2.5-flash',
  NEXT_PUBLIC_SUPABASE_URL: 'https://fake.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-service-key',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
  ENABLE_UPLOAD: 'true' as const,
  ENABLE_DELETE: 'true' as const,
  RATE_LIMIT_SECRET: 'a'.repeat(32),
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const request = new NextRequest(`http://localhost/api/documents/${id}`, {
    method: 'DELETE',
  })
  return [request, { params: Promise.resolve({ id }) }]
}

beforeEach(() => {
  vi.mocked(parseEnv).mockReturnValue(BASE_ENV)
  vi.mocked(deleteDocument).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/documents/[id]', () => {
  it('returns 403 when deletes are disabled', async () => {
    vi.mocked(parseEnv).mockReturnValue({ ...BASE_ENV, ENABLE_DELETE: 'false' })
    const [request, context] = makeRequest(VALID_UUID)
    const response = await DELETE(request, context)
    expect(response.status).toBe(403)
  })

  it('returns 400 for an invalid UUID', async () => {
    const [request, context] = makeRequest('not-a-valid-uuid')
    const response = await DELETE(request, context)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('UUID')
  })

  it('returns 400 for an empty id string', async () => {
    const [request, context] = makeRequest('')
    const response = await DELETE(request, context)
    expect(response.status).toBe(400)
  })

  it('returns 204 for a valid UUID', async () => {
    const [request, context] = makeRequest(VALID_UUID)
    const response = await DELETE(request, context)
    expect(response.status).toBe(204)
    expect(deleteDocument).toHaveBeenCalledWith(VALID_UUID)
  })
})
