import { retrieveChunks } from '@/lib/rag/retrieval'
import { generateAnswer } from '@/lib/gemini/generation'
import type { Citation, RagResponse, RetrievedSource } from '@/types'

export async function askQuestion(
  question: string,
  options?: { documentIds?: string[] },
): Promise<RagResponse> {
  const { chunks, latencyMs } = await retrieveChunks(question, {
    documentIds: options?.documentIds,
  })

  if (chunks.length === 0) {
    return {
      answer: 'The available documents do not contain information relevant to your question.',
      citations: [],
      retrieval: { chunksRetrieved: 0, latencyMs },
      cannotAnswer: true,
    }
  }

  // Build numbered source references for the generation prompt
  const sources: RetrievedSource[] = chunks.map((chunk, i) => ({
    sourceId: `SOURCE_${i + 1}`,
    chunkId: chunk.id,
    filename: chunk.filename,
    pageNumber: chunk.pageNumber,
    content: chunk.content,
  }))

  const result = await generateAnswer(question, sources)

  if (result.cannotAnswer) {
    return {
      answer: 'The available documents do not contain sufficient information to answer this question.',
      citations: [],
      retrieval: { chunksRetrieved: chunks.length, latencyMs },
      cannotAnswer: true,
    }
  }

  // Citation validation: only keep citations that reference a real retrieved source.
  // Metadata always comes from the DB record (source object), never from model output.
  const sourceMap = new Map(sources.map(s => [s.sourceId, s]))
  const chunkMap = new Map(chunks.map(c => [c.id, c]))

  const validCitations: Citation[] = []
  for (const citedId of result.citedSourceIds) {
    const source = sourceMap.get(citedId)
    if (!source) continue

    const chunk = chunkMap.get(source.chunkId)
    if (!chunk) continue

    validCitations.push({
      chunkId: chunk.id,
      filename: chunk.filename,
      fileType: chunk.fileType,
      pageNumber: chunk.pageNumber,
      passage: chunk.content,
      similarity: chunk.similarity,
    })
  }

  return {
    answer: result.answer,
    citations: validCitations,
    retrieval: { chunksRetrieved: chunks.length, latencyMs },
    cannotAnswer: false,
  }
}
