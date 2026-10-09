import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseEnv } from '@/lib/env'
import { RAG_CONFIG } from '@/lib/rag/config'
import { processDocument } from '@/lib/documents/processor'
import { listDocuments } from '@/lib/db/documents'
import type { ApiError, UploadResponse } from '@/types'

const ALLOWED_EXTENSIONS = new Set(RAG_CONFIG.allowedExtensions)
const ALLOWED_MIME_TYPES = new Set<string>(RAG_CONFIG.allowedMimeTypes)

// Validate the upload request shape
const uploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().min(0),
})

export async function GET(): Promise<NextResponse> {
  try {
    const documents = await listDocuments()
    return NextResponse.json(documents, { status: 200 })
  } catch {
    const body: ApiError = { error: 'Failed to list documents' }
    return NextResponse.json(body, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = parseEnv()

  if (env.ENABLE_UPLOAD !== 'true') {
    const body: ApiError = { error: 'Uploads are disabled in this deployment' }
    return NextResponse.json(body, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    const body: ApiError = { error: 'Invalid multipart form data' }
    return NextResponse.json(body, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    const body: ApiError = { error: 'No file provided — include a "file" field in form data' }
    return NextResponse.json(body, { status: 400 })
  }

  // Validate shape
  const parsed = uploadSchema.safeParse({
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  })
  if (!parsed.success) {
    const body: ApiError = { error: 'Invalid file metadata', details: parsed.error.message }
    return NextResponse.json(body, { status: 400 })
  }

  const { filename, mimeType, size } = parsed.data

  // Extension check
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext as (typeof RAG_CONFIG.allowedExtensions)[number])) {
    const body: ApiError = {
      error: `Unsupported file extension: ${ext}. Allowed: ${RAG_CONFIG.allowedExtensions.join(', ')}`,
    }
    return NextResponse.json(body, { status: 400 })
  }

  // MIME type check
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    const body: ApiError = {
      error: `Unsupported MIME type: ${mimeType}. Allowed: ${RAG_CONFIG.allowedMimeTypes.join(', ')}`,
    }
    return NextResponse.json(body, { status: 400 })
  }

  // Size check
  if (size === 0) {
    const body: ApiError = { error: 'File is empty' }
    return NextResponse.json(body, { status: 400 })
  }
  if (size > RAG_CONFIG.maxFileSizeBytes) {
    const body: ApiError = {
      error: `File too large: ${size} bytes. Maximum allowed: ${RAG_CONFIG.maxFileSizeBytes} bytes`,
    }
    return NextResponse.json(body, { status: 400 })
  }

  let fileBuffer: Buffer
  try {
    const arrayBuffer = await file.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  } catch {
    const body: ApiError = { error: 'Failed to read file data' }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const document = await processDocument(fileBuffer, filename, mimeType, size)
    const body: UploadResponse = { document, chunksCreated: document.chunkCount }
    return NextResponse.json(body, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    const body: ApiError = { error: message }
    return NextResponse.json(body, { status: 500 })
  }
}
