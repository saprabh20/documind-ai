/**
 * Seed the evaluation dataset.
 *
 * This script:
 *   1. Ingests the three sample evaluation documents (idempotent — skips if already present).
 *   2. Queries the resulting document chunks from the database.
 *   3. For each evaluation question, locates the relevant chunks by searching for expected
 *      text snippets within chunk content (deterministic substring matching — no LLM).
 *   4. Inserts eval_question rows with the real chunk UUIDs as expected_chunk_ids.
 *
 * Run once before executing scripts/run-evaluation.ts.
 *
 * Usage:
 *   npx tsx scripts/seed-eval-dataset.ts
 *
 * Requires .env.local with valid GEMINI_API_KEY and Supabase credentials.
 */
import { loadEnvConfig } from '@next/env'
import path from 'path'
import fs from 'fs'

loadEnvConfig(path.resolve(process.cwd()))

import { processDocument } from '../src/lib/documents/processor'
import { listDocuments } from '../src/lib/db/documents'
import { getChunksByDocument } from '../src/lib/db/chunks'
import { listEvalQuestions, insertEvalQuestion } from '../src/lib/evaluation/queries'
import type { Document, DocumentChunk } from '../src/types'

// ============================================================
// Evaluation question definitions
// Ground truth: expectedSnippets are substrings that MUST appear in the
// relevant chunk.  The seed script finds which chunk(s) contain each
// snippet and records those chunk IDs as the expected_chunk_ids.
// ============================================================

interface SeedQuestion {
  documentFile: string
  question: string
  expectedSnippets: string[]
}

const EVAL_QUESTIONS: SeedQuestion[] = [
  // ---- Nova Software Employee Handbook (10 questions) ----
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'How many days of paid annual leave do Nova Software employees receive per year?',
    expectedSnippets: ['18 days of paid annual leave'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'What are the core working hours at Nova Software?',
    expectedSnippets: ['10:00 AM to 3:00 PM in their local time zone'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'How many days per week can Nova Software employees work remotely?',
    expectedSnippets: ['up to 3 days per week'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'How often are performance reviews conducted at Nova Software?',
    expectedSnippets: ['twice per year', 'February and August'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'What is the maximum daily meal reimbursement during business travel at Nova Software?',
    expectedSnippets: ['$50 per day'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'What monthly stipend do Nova Software remote employees receive for home office costs?',
    expectedSnippets: ['$75 per month'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'What is the laptop procurement budget provided to Nova Software employees?',
    expectedSnippets: ['$1,500 every 3 years'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'What percentage of health insurance premium does Nova Software cover?',
    expectedSnippets: ['80% of the monthly premium for the standard health insurance'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'How many weeks of paid parental leave does Nova Software offer?',
    expectedSnippets: ['12 weeks of fully paid parental leave'],
  },
  {
    documentFile: 'nova-software-employee-handbook.txt',
    question: 'How much notice must a long-tenured Nova Software employee give when resigning?',
    expectedSnippets: ['4 weeks written notice'],
  },

  // ---- Meridian API Reference (10 questions) ----
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What is the base URL for the Meridian API?',
    expectedSnippets: ['https://api.meridian.io/v2'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'How should API keys be included in Meridian API requests?',
    expectedSnippets: ['Bearer token in the Authorization header'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What is the request rate limit for free tier Meridian accounts?',
    expectedSnippets: ['100 requests per minute'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What format do live Meridian API keys use?',
    expectedSnippets: ['mk_live_'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What is the maximum number of records per page the Meridian API can return?',
    expectedSnippets: ['maximum: 500'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What HTTP status code does the Meridian API return when the rate limit is exceeded?',
    expectedSnippets: ['429'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'How does Meridian verify the authenticity of webhook payloads?',
    expectedSnippets: ['HMAC-SHA256'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'How long does Meridian retain data for free tier users?',
    expectedSnippets: ['90 days'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What is the maximum number of operations in a single Meridian batch request?',
    expectedSnippets: ['up to 100 individual operations'],
  },
  {
    documentFile: 'meridian-api-reference.txt',
    question: 'What HTTP error code does the Meridian API return for an invalid or missing API key?',
    expectedSnippets: ['401'],
  },

  // ---- Aurora Platform Guide (10 questions) ----
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What is the minimum amount of RAM required to use Aurora?',
    expectedSnippets: ['8 GB RAM'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'How much does the Aurora Pro plan cost per month?',
    expectedSnippets: ['$99 per month'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What is the support email address for Aurora?',
    expectedSnippets: ['support@aurora.io'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What is the support response time guarantee for Aurora Pro plan customers?',
    expectedSnippets: ['4 hours', '7 days per week'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'How long does Aurora retain data for Starter plan users?',
    expectedSnippets: ['6 months from the date of ingestion'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What is the maximum file size for a single upload in Aurora?',
    expectedSnippets: ['2 GB'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'Which Aurora subscription plans include Single Sign-On support?',
    expectedSnippets: ['SSO is available on Pro and Enterprise plans'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What SSO authentication protocols does Aurora support?',
    expectedSnippets: ['SAML 2.0', 'OpenID Connect'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'What is the initial response time commitment for Aurora Enterprise support?',
    expectedSnippets: ['1 hour, 24 hours per day'],
  },
  {
    documentFile: 'aurora-platform-guide.txt',
    question: 'Does Aurora provide a GraphQL API?',
    expectedSnippets: ['GraphQL endpoint'],
  },
]

// ============================================================
// Helpers
// ============================================================

function findExpectedChunkIds(
  chunks: DocumentChunk[],
  snippets: string[],
): string[] {
  const ids: string[] = []
  for (const chunk of chunks) {
    const lower = chunk.content.toLowerCase()
    const matches = snippets.some(s => lower.includes(s.toLowerCase()))
    if (matches && !ids.includes(chunk.id)) {
      ids.push(chunk.id)
    }
  }
  return ids
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== DocuMind AI — Eval Dataset Seeder ===\n')

  // 1. Ingest documents (idempotent)
  const docsDir = path.resolve(process.cwd(), 'docs/eval-documents')
  const existingDocs = await listDocuments()
  const existingByFilename = new Map<string, Document>(existingDocs.map(d => [d.filename, d]))

  const docFiles = ['nova-software-employee-handbook.txt', 'meridian-api-reference.txt', 'aurora-platform-guide.txt']
  const ingestedDocs = new Map<string, Document>()

  for (const filename of docFiles) {
    const existing = existingByFilename.get(filename)
    if (existing) {
      console.log(`  [SKIP] ${filename} — already ingested (id: ${existing.id})`)
      ingestedDocs.set(filename, existing)
      continue
    }

    console.log(`  [INGEST] ${filename}…`)
    const filePath = path.join(docsDir, filename)
    const buffer = fs.readFileSync(filePath)
    const mimeType = 'text/plain'
    const fileSizeBytes = buffer.length

    const doc = await processDocument(buffer, filename, mimeType, fileSizeBytes)
    console.log(`  [DONE]   ${filename} — ${doc.chunkCount} chunks, id: ${doc.id}`)
    ingestedDocs.set(filename, doc)
  }

  console.log('')

  // 2. Load chunks for each document
  const chunksByDoc = new Map<string, DocumentChunk[]>()
  for (const [filename, doc] of ingestedDocs) {
    const chunks = await getChunksByDocument(doc.id)
    chunksByDoc.set(filename, chunks)
    console.log(`  [CHUNKS] ${filename}: ${chunks.length} chunks`)
  }

  console.log('')

  // 3. Check existing eval questions (idempotent)
  const existingQuestions = await listEvalQuestions()
  const existingQuestionTexts = new Set(existingQuestions.map(q => q.question))

  // 4. Insert eval questions
  let created = 0
  let skipped = 0
  let warnings = 0

  for (const def of EVAL_QUESTIONS) {
    if (existingQuestionTexts.has(def.question)) {
      skipped++
      continue
    }

    const doc = ingestedDocs.get(def.documentFile)
    if (!doc) {
      console.warn(`  [WARN] Unknown documentFile: ${def.documentFile}`)
      warnings++
      continue
    }

    const chunks = chunksByDoc.get(def.documentFile) ?? []
    const expectedChunkIds = findExpectedChunkIds(chunks, def.expectedSnippets)

    if (expectedChunkIds.length === 0) {
      console.warn(`  [WARN] No chunk found for: "${def.question.slice(0, 60)}…"`)
      console.warn(`         Snippets: ${def.expectedSnippets.join(' | ')}`)
      warnings++
      continue
    }

    await insertEvalQuestion({
      documentId: doc.id,
      question: def.question,
      expectedChunkIds,
    })
    console.log(`  [OK] "${def.question.slice(0, 70)}…" → ${expectedChunkIds.length} chunk(s)`)
    created++
  }

  console.log('')
  console.log(`=== Seeding complete ===`)
  console.log(`  Questions created : ${created}`)
  console.log(`  Already existed   : ${skipped}`)
  if (warnings > 0) console.warn(`  Warnings          : ${warnings}`)
  console.log('')
  console.log('Run the evaluation with:')
  console.log('  npm run eval')
}

main().catch(err => {
  console.error('Seeder failed:', err)
  process.exit(1)
})
