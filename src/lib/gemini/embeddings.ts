import { getGemini } from '@/lib/gemini/client'
import { RAG_CONFIG } from '@/lib/rag/config'

function getModelName(): string {
  return process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function embedWithRetry(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const model = getModelName()
  let lastError: unknown

  for (let attempt = 0; attempt <= RAG_CONFIG.embeddingMaxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = RAG_CONFIG.embeddingRetryBaseMs * Math.pow(2, attempt - 1)
      await sleep(backoffMs)
    }

    try {
      const gemini = getGemini()
      const result = await gemini.models.embedContent({
        model,
        contents: text,
        config: {
          taskType,
          outputDimensionality: RAG_CONFIG.embeddingDimensions,
        },
      })

      const values = result.embeddings?.[0]?.values
      if (!values || values.length !== RAG_CONFIG.embeddingDimensions) {
        throw new Error(
          `Expected ${RAG_CONFIG.embeddingDimensions}-dim embedding, got ${values?.length ?? 0}`,
        )
      }

      return values
    } catch (err) {
      lastError = err
      const isRateLimited =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate'))
      if (!isRateLimited) throw err
      // Rate limited: retry with backoff
    }
  }

  throw lastError
}

/**
 * Embed a document chunk for ingestion.
 * Uses RETRIEVAL_DOCUMENT task type so the vector is optimised for retrieval.
 * Caller is responsible for inserting the inter-call delay (embeddingDelayMs).
 */
export async function embedChunk(content: string): Promise<number[]> {
  return embedWithRetry(content, 'RETRIEVAL_DOCUMENT')
}

/**
 * Embed a user query for similarity search.
 * Uses RETRIEVAL_QUERY task type so the vector is optimised for querying.
 */
export async function embedQuery(question: string): Promise<number[]> {
  return embedWithRetry(question, 'RETRIEVAL_QUERY')
}
