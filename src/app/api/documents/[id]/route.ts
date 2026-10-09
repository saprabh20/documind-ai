import { NextRequest, NextResponse } from 'next/server'
import { parseEnv } from '@/lib/env'
import { deleteDocument } from '@/lib/db/documents'
import type { ApiError } from '@/types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const env = parseEnv()

  if (env.ENABLE_DELETE !== 'true') {
    const body: ApiError = { error: 'Deletes are disabled in this deployment' }
    return NextResponse.json(body, { status: 403 })
  }

  const { id } = await params

  if (!id || !UUID_RE.test(id)) {
    const body: ApiError = { error: 'Invalid document ID — must be a valid UUID' }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    await deleteDocument(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    const body: ApiError = { error: 'Failed to delete document' }
    return NextResponse.json(body, { status: 500 })
  }
}
