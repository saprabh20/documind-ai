/**
 * Seed demo documents for the public DocuMind AI demo.
 *
 * Ingests the three sample documents from docs/eval-documents/ into the
 * Supabase database. Idempotent — skips any document whose filename is
 * already present.
 *
 * Run this once on a fresh Supabase instance before opening the public demo.
 * Visitors will then be able to ask questions against real document content.
 *
 * Usage:
 *   npm run seed:demo
 *   -- or --
 *   npx tsx scripts/seed-demo-docs.ts
 *
 * Requires .env.local with valid GEMINI_API_KEY and Supabase credentials.
 * Run docs/migrations/001_initial_schema.sql first if the schema doesn't exist.
 */
import { loadEnvConfig } from '@next/env'
import path from 'path'
import fs from 'fs'

loadEnvConfig(path.resolve(process.cwd()))

import { processDocument } from '../src/lib/documents/processor'
import { listDocuments } from '../src/lib/db/documents'

const DEMO_DOCS = [
  {
    filename: 'nova-software-employee-handbook.txt',
    mimeType: 'text/plain',
    description: 'Nova Software Employee Handbook — HR policies, benefits, PTO',
  },
  {
    filename: 'meridian-api-reference.txt',
    mimeType: 'text/plain',
    description: 'Meridian API Reference — authentication, rate limits, endpoints',
  },
  {
    filename: 'aurora-platform-guide.txt',
    mimeType: 'text/plain',
    description: 'Aurora Platform Guide — system requirements, pricing, support',
  },
]

const DOCS_DIR = path.join(process.cwd(), 'docs', 'eval-documents')

async function main() {
  console.log('DocuMind AI — Seeding demo documents…\n')

  // Get existing documents to skip duplicates.
  const existing = await listDocuments()
  const existingFilenames = new Set(existing.map(d => d.filename))

  let seeded = 0
  let skipped = 0

  for (const doc of DEMO_DOCS) {
    if (existingFilenames.has(doc.filename)) {
      console.log(`  ⊙ Skipped  ${doc.filename} (already present)`)
      skipped++
      continue
    }

    const filePath = path.join(DOCS_DIR, doc.filename)
    if (!fs.existsSync(filePath)) {
      console.error(`  ✗ Missing  ${filePath}`)
      continue
    }

    const buffer = fs.readFileSync(filePath)
    const result = await processDocument(buffer, doc.filename, doc.mimeType, buffer.length)

    console.log(`  ✓ Ingested ${doc.filename} — ${result.chunkCount} chunks`)
    seeded++
  }

  console.log(`\nDone. Seeded: ${seeded}, Skipped: ${skipped}`)
  console.log('\nVisitors can now ask questions on the Ask AI page.')
  console.log('Suggested questions to test:')
  console.log('  • How many days of PTO do employees receive per year?')
  console.log('  • What are the rate limits for the Meridian API free tier?')
  console.log('  • What is the maximum file upload size on the Aurora Platform?')
}

main().catch(err => {
  console.error('Seeding failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
