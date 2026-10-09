import { getDb } from '@/lib/db/client'
import type { Document, InsertDocumentData } from '@/types'

function rowToDocument(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    filename: row.filename as string,
    fileType: row.file_type as Document['fileType'],
    fileSizeBytes: row.file_size_bytes as number,
    pageCount: row.page_count as number | null,
    chunkCount: row.chunk_count as number,
    createdAt: row.created_at as string,
  }
}

export async function insertDocument(data: InsertDocumentData): Promise<Document> {
  const db = getDb()
  const { data: row, error } = await db
    .from('documents')
    .insert({
      filename: data.filename,
      file_type: data.fileType,
      file_size_bytes: data.fileSizeBytes,
      page_count: data.pageCount,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to insert document: ${error.message}`)
  return rowToDocument(row as Record<string, unknown>)
}

export async function listDocuments(): Promise<Document[]> {
  const db = getDb()
  const { data, error } = await db
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list documents: ${error.message}`)
  return (data as Record<string, unknown>[]).map(rowToDocument)
}

export async function getDocument(id: string): Promise<Document | null> {
  const db = getDb()
  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null  // row not found
    throw new Error(`Failed to get document: ${error.message}`)
  }
  return rowToDocument(data as Record<string, unknown>)
}

export async function deleteDocument(id: string): Promise<void> {
  const db = getDb()
  const { error } = await db.from('documents').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete document: ${error.message}`)
}

export async function updateDocumentChunkCount(
  id: string,
  chunkCount: number,
  pageCount: number | null,
): Promise<void> {
  const db = getDb()
  const { error } = await db
    .from('documents')
    .update({ chunk_count: chunkCount, page_count: pageCount })
    .eq('id', id)
  if (error) throw new Error(`Failed to update document: ${error.message}`)
}
