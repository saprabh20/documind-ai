#!/usr/bin/env node
/**
 * DocuMind AI — Gemini Model Verification Script
 *
 * Verifies that the configured Gemini models are accessible with your API key
 * and return the expected output shapes.
 *
 * Usage:
 *   npx tsx scripts/verify-models.ts
 *
 * Reads from .env.local automatically if dotenv is available,
 * otherwise reads from the current process environment.
 */

import { loadEnvConfig } from '@next/env'
import { GoogleGenAI } from '@google/genai'

// Load .env.local (and .env) using the same loader Next.js uses.
// Must be called before any process.env reads.
loadEnvConfig(process.cwd())

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001'
const GENERATION_MODEL = process.env.GEMINI_GENERATION_MODEL ?? 'gemini-3.8-flash'
const API_KEY = process.env.GEMINI_API_KEY

function printHeader(): void {
  console.log('DocuMind AI — Gemini Model Verification')
  console.log('=========================================')
  console.log(`Embedding model : ${EMBEDDING_MODEL}`)
  console.log(`Generation model: ${GENERATION_MODEL}`)
  console.log()
}

function checkApiKey(): void {
  if (!API_KEY) {
    console.error('✗ GEMINI_API_KEY is not set.')
    console.error('  1. Copy .env.local.example to .env.local')
    console.error('  2. Fill in your GEMINI_API_KEY')
    console.error('  3. Re-run: npx tsx scripts/verify-models.ts')
    process.exit(1)
  }
}

async function verifyEmbeddingModel(ai: GoogleGenAI): Promise<boolean> {
  process.stdout.write(`Testing ${EMBEDDING_MODEL} (embedding, 768-dim) ... `)
  try {
    // gemini-embedding-001 supports taskType.
    // Test with both RETRIEVAL_DOCUMENT (ingestion) and RETRIEVAL_QUERY (retrieval).
    const docResponse = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: 'DocuMind AI model verification test.',
      config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 768 },
    })
    const queryResponse = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: 'DocuMind AI verification query.',
      config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 },
    })

    const docValues = docResponse.embeddings?.[0]?.values
    const queryValues = queryResponse.embeddings?.[0]?.values
    if (!docValues || docValues.length !== 768) {
      throw new Error(`Expected 768 doc dimensions, got ${docValues?.length ?? 'undefined'}`)
    }
    if (!queryValues || queryValues.length !== 768) {
      throw new Error(`Expected 768 query dimensions, got ${queryValues?.length ?? 'undefined'}`)
    }

    console.log(`✓  (${docValues.length} dimensions, RETRIEVAL_DOCUMENT + RETRIEVAL_QUERY OK)`)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`✗`)
    console.error(`   Error: ${message}`)

    if (message.includes('404') || message.includes('not found')) {
      console.error(`   → Model "${EMBEDDING_MODEL}" was not found.`)
      console.error(`     Set GEMINI_EMBEDDING_MODEL in .env.local to a supported model.`)
      console.error(`     Default (verified): gemini-embedding-001`)
    } else if (message.includes('403') || message.includes('permission')) {
      console.error(`   → Access denied. This model may require billing to be enabled.`)
      console.error(`     Check: https://aistudio.google.com/`)
    } else if (message.includes('429')) {
      console.error(`   → Rate limit hit. Wait a moment and try again.`)
    }
    return false
  }
}

async function verifyGenerationModel(ai: GoogleGenAI): Promise<boolean> {
  process.stdout.write(`Testing ${GENERATION_MODEL} (generation) ... `)
  try {
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: 'Reply with exactly the text: DocuMind AI verification OK',
    })

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text.includes('DocuMind')) {
      throw new Error(`Unexpected response: "${text.slice(0, 80)}"`)
    }

    console.log(`✓`)
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`✗`)
    console.error(`   Error: ${message}`)

    if (message.includes('404') || message.includes('not found') || message.includes('not supported')) {
      console.error(`   → Model "${GENERATION_MODEL}" was not found or not available.`)
      console.error(`     Set GEMINI_GENERATION_MODEL in .env.local to a supported model.`)
      console.error(`     Free-tier options (Oct 2026):`)
      console.error(`       gemini-3.8-flash        (default — verified reachable)`)
      console.error(`       gemini-3.5-flash-lite   (alternative free-tier option)`)
      console.error(`       gemini-2.5-flash        (legacy — restricted to existing projects)`)
      console.error(`     Current models: https://ai.google.dev/gemini-api/docs/models`)
    } else if (message.includes('403') || message.includes('permission')) {
      console.error(`   → Access denied. This model may require billing.`)
    }
    return false
  }
}

async function main(): Promise<void> {
  printHeader()
  checkApiKey()

  const ai = new GoogleGenAI({ apiKey: API_KEY! })

  const embeddingOk = await verifyEmbeddingModel(ai)
  const generationOk = await verifyGenerationModel(ai)

  console.log()
  if (embeddingOk && generationOk) {
    console.log('✓  All models verified. Ready to proceed with Phase 2.')
  } else {
    console.error('✗  One or more models failed. Update .env.local and re-run this script.')
    console.error('   List available models: https://ai.google.dev/gemini-api/docs/models')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
