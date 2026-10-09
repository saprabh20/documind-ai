import { getDb } from '@/lib/db/client'
import type { DocumentChunk, DocumentChunkWithSource, FileType, InsertChunkData } from '@/types'

function rowToChunk(row: Record<string, unknown>): DocumentChunk {
  return {
    id: row.id as string,
    documentId: row.document_id as string,
    chunkIndex: row.chunk_index as number,
    content: row.content as string,
    pageNumber: row.page_number as number | null,
    tokenCount: row.token_count as number,
    createdAt: row.created_at as string,
  }
}

export async function insertChunk(data: InsertChunkData): Promise<DocumentChunk> {
  const db = getDb()
  const { data: row, error } = await db
    .from('document_chunks')
    .insert({
      document_id: data.documentId,
      chunk_index: data.chunkIndex,
      content: data.content,
      page_number: data.pageNumber,
      token_count: data.tokenCount,
      embedding: JSON.stringify(data.embedding),
    })
    .select('id, document_id, chunk_index, content, page_number, token_count, created_at')
    .single()

  if (error) throw new Error(`Failed to insert chunk: ${error.message}`)
  return rowToChunk(row as Record<string, unknown>)
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = getDb()
  const { data, error } = await db
    .from('document_chunks')
    .select('id, document_id, chunk_index, content, page_number, token_count, created_at')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error) throw new Error(`Failed to get chunks: ${error.message}`)
  return (data as Record<string, unknown>[]).map(rowToChunk)
}

/**
 * Vector similarity search via the `match_chunks` Postgres function.
 * Returns top-k chunks ranked by cosine similarity to the query embedding.
 */
export async function retrieveSimilarChunks(
  queryEmbedding: number[],
  topK: number,
  documentIds?: string[],
): Promise<DocumentChunkWithSource[]> {
  const db = getDb()
  const { data, error } = await db.rpc('match_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    filter_document_ids: documentIds ?? null,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)

  return (data as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    documentId: row.document_id as string,
    chunkIndex: row.chunk_index as number,
    content: row.content as string,
    pageNumber: row.page_number as number | null,
    tokenCount: row.token_count as number,
    createdAt: '',
    filename: row.filename as string,
    fileType: row.file_type as FileType,
    similarity: row.similarity as number,
  }))
}
