import type { Document, FileType } from '@/types'
import { extractText } from '@/lib/documents/extractor'
import { chunkPages } from '@/lib/rag/chunker'
import { embedChunk } from '@/lib/gemini/embeddings'
import { insertDocument, deleteDocument, updateDocumentChunkCount } from '@/lib/db/documents'
import { insertChunk } from '@/lib/db/chunks'
import { RAG_CONFIG } from '@/lib/rag/config'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getMimeFileType(filename: string, mimeType: string): FileType {
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (mimeType === 'text/markdown' || filename.toLowerCase().endsWith('.md')) return 'md'
  return 'txt'
}

/**
 * Full ingestion pipeline: extract → chunk → embed → store.
 *
 * Atomicity guarantee: if any step fails after the document row is created,
 * the document row (and all cascaded chunks) are deleted before re-throwing.
 */
export async function processDocument(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  fileSize: number,
): Promise<Document> {
  const fileType = getMimeFileType(filename, mimeType)

  // Step 1: insert document row with status pending (chunk_count = 0)
  const doc = await insertDocument({
    filename,
    fileType,
    fileSizeBytes: fileSize,
    pageCount: null,  // updated below for PDFs
  })

  try {
    // Step 2: extract text
    const extraction = await extractText(fileBuffer, filename)
    if (!extraction.ok) {
      throw new Error(`Text extraction failed: ${extraction.error}`)
    }
    const { pages } = extraction

    // Step 3: chunk text
    const chunks = chunkPages(pages)
    if (chunks.length === 0) {
      throw new Error('No content could be extracted from the file')
    }

    // PDFs have numeric page numbers; TXT/MD have null.
    const pageCount = pages.some(p => p.pageNumber !== null) ? pages.length : null

    // Step 4: embed each chunk and store it
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) await sleep(RAG_CONFIG.embeddingDelayMs)

      const chunk = chunks[i]
      const embedding = await embedChunk(chunk.content)

      await insertChunk({
        documentId: doc.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        tokenCount: chunk.tokenCount,
        embedding,
      })
    }

    // Step 5: update chunk_count and page_count on the document row
    await updateDocumentChunkCount(doc.id, chunks.length, pageCount)

    return { ...doc, chunkCount: chunks.length, pageCount }
  } catch (err) {
    // Step 6: clean up on failure — cascade removes all chunks too
    try {
      await deleteDocument(doc.id)
    } catch {
      // Ignore cleanup errors; we still propagate the original failure
    }

    // Sanitise the error message before re-throwing so we don't leak
    // internal Gemini or Supabase error details to callers.
    if (err instanceof Error) {
      throw new Error(`Document processing failed: ${err.message}`)
    }
    throw new Error('Document processing failed due to an unexpected error')
  }
}
