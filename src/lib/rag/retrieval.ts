import { embedQuery } from '@/lib/gemini/embeddings'
import { retrieveSimilarChunks } from '@/lib/db/chunks'
import { RAG_CONFIG } from '@/lib/rag/config'
import type { DocumentChunkWithSource } from '@/types'

export async function retrieveChunks(
  question: string,
  options?: { topK?: number; documentIds?: string[] },
): Promise<{ chunks: DocumentChunkWithSource[]; latencyMs: number }> {
  const topK = options?.topK ?? RAG_CONFIG.topK
  const start = performance.now()

  const queryEmbedding = await embedQuery(question)
  const chunks = await retrieveSimilarChunks(
    queryEmbedding,
    topK,
    options?.documentIds,
  )

  const latencyMs = Math.round(performance.now() - start)

  const filtered = chunks.filter(
    c => c.similarity >= RAG_CONFIG.minSimilarityThreshold,
  )

  return { chunks: filtered, latencyMs }
}
