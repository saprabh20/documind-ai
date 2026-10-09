/**
 * Phase 2 Integration Test — DocuMind AI
 *
 * Calls processDocument directly (not via HTTP) to verify the full ingestion
 * pipeline against the real Supabase instance.
 *
 * Run with: npx tsx scripts/integration-test.ts
 *
 * Does NOT print any environment variable values.
 */

import { loadEnvConfig } from '@next/env'
import path from 'path'

// Load .env.local before importing any modules that read process.env
loadEnvConfig(path.resolve(process.cwd()))

// Import after env is loaded so module-level singletons pick up the vars
import { processDocument } from '../src/lib/documents/processor'
import { getDb } from '../src/lib/db/client'
import { getDocument } from '../src/lib/db/documents'

// ── Test document ──────────────────────────────────────────────────────────────
const TEST_DOC_TEXT = `
Introduction to Retrieval-Augmented Generation

Retrieval-Augmented Generation (RAG) is a technique that combines the strengths
of large language models with the precision of information retrieval systems.
Instead of relying solely on the model's parametric knowledge, RAG first queries
an external knowledge base to retrieve relevant context, then conditions the LLM
generation on that context.

How RAG Works

The process begins with a user submitting a natural language query. The query is
converted into a dense vector embedding using a pre-trained encoder model. This
embedding is then used to search a vector database containing embeddings of all
documents in the knowledge base. The top-k most similar document chunks are
retrieved and passed as context to the language model along with the original
question.

The language model then synthesizes an answer using both its pre-trained knowledge
and the retrieved context. This grounding in retrieved evidence reduces hallucination
and allows the model to cite specific passages, improving reliability and
trustworthiness of responses.

Benefits of RAG

RAG offers several key advantages over pure parametric retrieval. First, it allows
models to access up-to-date information without retraining, since the knowledge
base can be updated independently. Second, the retrieval step provides a form of
interpretability: users can inspect exactly which passages were used to generate
the answer. Third, RAG systems can be adapted to domain-specific tasks simply by
populating the knowledge base with relevant documents.

Implementation Considerations

Effective RAG requires careful attention to chunking strategy. Chunks that are too
small may lack context; chunks that are too large may dilute relevance. A sliding
window approach with overlap ensures that relevant information is not split across
chunk boundaries. Embedding model choice is also critical: the model should be
optimised for asymmetric search, where short queries are matched to longer document
passages.
`.trim()

// ── Helpers ────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`)
    passed++
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== DocuMind AI — Phase 2 Integration Test ===\n')

  const filename = 'integration-test-rag-intro.txt'
  const mimeType = 'text/plain'
  const buffer = Buffer.from(TEST_DOC_TEXT, 'utf-8')
  const fileSize = buffer.length

  // ── 1. Ingest ────────────────────────────────────────────────────────────────
  console.log('Step 1: Ingesting test document …')
  let doc
  try {
    doc = await processDocument(buffer, filename, mimeType, fileSize)
    check('Document row created', !!doc.id)
    check('Filename stored correctly', doc.filename === filename)
    check('File type is txt', doc.fileType === 'txt')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    check('Ingestion completed without error', false, msg)
    console.log('\n=== ABORTED — could not ingest document ===\n')
    process.exit(1)
  }

  // ── 2. Verify document row ───────────────────────────────────────────────────
  console.log('\nStep 2: Verifying documents table …')
  const storedDoc = await getDocument(doc.id)
  check('Document retrievable by ID', storedDoc !== null)
  check('chunk_count > 0', (storedDoc?.chunkCount ?? 0) > 0,
    `chunk_count=${storedDoc?.chunkCount}`)
  const reportedChunks = storedDoc?.chunkCount ?? 0
  console.log(`  INFO  Chunks reported: ${reportedChunks}`)

  // ── 3. Verify chunk rows ─────────────────────────────────────────────────────
  console.log('\nStep 3: Verifying document_chunks table …')
  const db = getDb()
  const { data: chunkRows, error: chunkError } = await db
    .from('document_chunks')
    .select('id, chunk_index, content, token_count, embedding')
    .eq('document_id', doc.id)
    .order('chunk_index', { ascending: true })

  if (chunkError) {
    check('Chunk rows queryable', false, chunkError.message)
  } else {
    const rows = chunkRows as Array<{
      id: string
      chunk_index: number
      content: string
      token_count: number
      embedding: number[] | null
    }>

    check('At least one chunk row exists', rows.length > 0, `rows=${rows.length}`)
    check(
      'chunk_count matches actual chunk rows',
      rows.length === reportedChunks,
      `db rows=${rows.length}, reported=${reportedChunks}`,
    )

    const allContentNonEmpty = rows.every(r => r.content.length > 0)
    check('All chunk content fields are non-empty', allContentNonEmpty)

    // Verify embedding dimensions.
    // Supabase returns vector columns as a JSON string — parse before checking length.
    let allEmbeddings768 = true
    let missingEmbeddings = 0
    for (const row of rows) {
      if (!row.embedding) {
        missingEmbeddings++
        allEmbeddings768 = false
      } else {
        const arr: number[] =
          typeof row.embedding === 'string'
            ? (JSON.parse(row.embedding) as number[])
            : (row.embedding as number[])
        if (arr.length !== 768) {
          allEmbeddings768 = false
        }
      }
    }
    check(
      'Every stored embedding is exactly 768 dimensions',
      allEmbeddings768,
      `missing=${missingEmbeddings}`,
    )

    console.log(`  INFO  Total chunks in DB: ${rows.length}`)
    console.log(`  INFO  Sample chunk 0 token_count: ${rows[0]?.token_count ?? 'n/a'}`)
  }

  // ── 4. Delete and verify cascade ─────────────────────────────────────────────
  console.log('\nStep 4: Deleting document and verifying cascade …')
  const { error: deleteError } = await db
    .from('documents')
    .delete()
    .eq('id', doc.id)

  check('Document deleted without error', !deleteError, deleteError?.message)

  const afterDelete = await getDocument(doc.id)
  check('Document row gone after delete', afterDelete === null)

  const { data: chunksAfter, error: chunkAfterError } = await db
    .from('document_chunks')
    .select('id')
    .eq('document_id', doc.id)

  check(
    'Chunk rows cascade-deleted',
    !chunkAfterError && (chunksAfter?.length ?? 0) === 0,
    chunkAfterError?.message,
  )

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Unhandled error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
