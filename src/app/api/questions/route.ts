import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { askQuestion } from '@/lib/rag/pipeline'
import { RAG_CONFIG } from '@/lib/rag/config'
import type { ApiError } from '@/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question must not be empty')
    .max(RAG_CONFIG.maxQuestionLength, `Question must be at most ${RAG_CONFIG.maxQuestionLength} characters`),
  documentIds: z
    .array(z.string().regex(UUID_REGEX, 'Each documentId must be a valid UUID'))
    .optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    const err: ApiError = { error: 'Invalid JSON body' }
    return NextResponse.json(err, { status: 400 })
  }

  const parsed = questionSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map(issue => issue.message)
      .join('; ')
    const err: ApiError = { error: 'Invalid request', details }
    return NextResponse.json(err, { status: 400 })
  }

  const { question, documentIds } = parsed.data

  try {
    const result = await askQuestion(question, { documentIds })
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : ''

    // Surface 503 for Gemini unavailability so the client can distinguish
    if (message.includes('retries')) {
      const body: ApiError = { error: 'AI service temporarily unavailable. Please try again later.' }
      return NextResponse.json(body, { status: 503 })
    }

    const body: ApiError = { error: 'An unexpected error occurred while processing your question.' }
    return NextResponse.json(body, { status: 500 })
  }
}
