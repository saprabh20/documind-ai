/**
 * Retrieval evaluation runner for DocuMind AI.
 *
 * Runs all eval_questions through the real Gemini embedding API and pgvector
 * retrieval, computes Hit@1/3/5, Recall@1/3/5, MRR, and latency metrics,
 * stores the results, and prints a summary.
 *
 * This script does NOT call Gemini answer generation — only embeddings.
 *
 * Run once to establish the baseline. Do not run repeatedly without reason
 * as each question consumes a Gemini embedding API call.
 *
 * Usage:
 *   npm run eval
 *   -- or --
 *   npx tsx scripts/run-evaluation.ts
 *
 * Requires .env.local with valid GEMINI_API_KEY and Supabase credentials.
 * Run scripts/seed-eval-dataset.ts first if no eval questions exist.
 */
import { loadEnvConfig } from '@next/env'
import path from 'path'

loadEnvConfig(path.resolve(process.cwd()))

import { runEvaluation } from '../src/lib/evaluation/runner'
import { listEvalQuestions } from '../src/lib/evaluation/queries'
import { computePerQuestionMetrics, computeHitAtK } from '../src/lib/evaluation/metrics'
import type { EvalRunSummary } from '../src/types'

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function bar(value: number, width = 20): string {
  const filled = Math.round(value * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

async function printSummary(summary: EvalRunSummary) {
  // Re-fetch questions to compute multi-K metrics.
  const allQuestions = await listEvalQuestions()
  const questionMap = new Map(allQuestions.map(q => [q.id, q]))

  const perQuestionMetrics = summary.results.map(r => {
    const q = questionMap.get(r.questionId)
    return computePerQuestionMetrics(
      r.retrievedChunkIds,
      q?.expectedChunkIds ?? [],
      r.latencyMs,
    )
  })

  // Compute aggregates from fresh results for the full printout.
  const agg = (() => {
    if (perQuestionMetrics.length === 0) return null
    const latencies = perQuestionMetrics.map(m => m.latencyMs).sort((a, b) => a - b)
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    const sortedPct = (sorted: number[], p: number) =>
      sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]

    return {
      hitAt1:    mean(perQuestionMetrics.map(m => m.hitAt1)),
      hitAt3:    mean(perQuestionMetrics.map(m => m.hitAt3)),
      hitAt5:    mean(perQuestionMetrics.map(m => m.hitAt5)),
      recallAt1: mean(perQuestionMetrics.map(m => m.recallAt1)),
      recallAt3: mean(perQuestionMetrics.map(m => m.recallAt3)),
      recallAt5: mean(perQuestionMetrics.map(m => m.recallAt5)),
      mrr:       mean(perQuestionMetrics.map(m => m.reciprocalRank)),
      avgLatency:    mean(latencies),
      medianLatency: sortedPct(latencies, 0.5),
      p95Latency:    perQuestionMetrics.length >= 20
        ? sortedPct(latencies, 0.95)
        : latencies[latencies.length - 1],
    }
  })()

  if (!agg) return

  const divider = '─'.repeat(52)

  console.log('\n' + divider)
  console.log(' DocuMind AI — Retrieval Evaluation')
  console.log(divider)
  console.log(` Run ID        : ${summary.id}`)
  console.log(` Timestamp     : ${new Date(summary.runAt).toISOString()}`)
  console.log(` Questions     : ${summary.questionCount}`)
  console.log(` Top-K         : ${summary.topK}`)
  console.log(` Chunk size    : ${summary.chunkSize} tokens`)
  console.log(` Overlap       : ${summary.chunkOverlap} tokens`)
  if (summary.notes) console.log(` Notes         : ${summary.notes}`)
  console.log(divider)

  console.log('\n Hit@K and Recall@K\n')
  for (const { k, hit, recall } of [
    { k: '@1', hit: agg.hitAt1,    recall: agg.recallAt1 },
    { k: '@3', hit: agg.hitAt3,    recall: agg.recallAt3 },
    { k: '@5', hit: agg.hitAt5,    recall: agg.recallAt5 },
  ]) {
    console.log(` Hit${k.padEnd(3)}  ${bar(hit)} ${pct(hit)}`)
    console.log(` Recall${k} ${bar(recall)} ${pct(recall)}`)
    console.log('')
  }

  console.log(` MRR     ${bar(agg.mrr)} ${agg.mrr.toFixed(3)}`)
  console.log('')
  console.log(divider)
  console.log(' Retrieval latency')
  console.log(`   Avg    : ${Math.round(agg.avgLatency)} ms`)
  console.log(`   Median : ${Math.round(agg.medianLatency)} ms`)
  console.log(`   p95    : ${Math.round(agg.p95Latency)} ms`)
  console.log(divider)

  // Per-question breakdown
  console.log('\n Per-question results\n')
  const hits: string[] = []
  const misses: string[] = []

  for (const r of summary.results) {
    const q = questionMap.get(r.questionId)
    const question = q?.question ?? r.questionId
    const hitAtFive = computeHitAtK(r.retrievedChunkIds, q?.expectedChunkIds ?? [], 5) === 1
    const rank = r.reciprocalRank > 0 ? `rank ${Math.round(1 / r.reciprocalRank)}` : 'not found'
    const line = `  [${hitAtFive ? 'HIT ' : 'MISS'}] ${question.slice(0, 65).padEnd(65)} ${rank}`
    if (hitAtFive) hits.push(line)
    else misses.push(line)
  }

  for (const line of hits) console.log(line)
  for (const line of misses) console.log(line)

  console.log('\n' + divider)
  console.log(` Summary: ${hits.length} hits, ${misses.length} misses`)
  console.log(divider)

  // README-ready block
  console.log('\n=== README-ready results ===\n')
  console.log('Retrieval Evaluation')
  console.log('--------------------')
  console.log(`Questions      : ${summary.questionCount}`)
  console.log(`Hit@1          : ${pct(agg.hitAt1)}`)
  console.log(`Hit@3          : ${pct(agg.hitAt3)}`)
  console.log(`Hit@5          : ${pct(agg.hitAt5)}`)
  console.log(`Recall@1       : ${pct(agg.recallAt1)}`)
  console.log(`Recall@3       : ${pct(agg.recallAt3)}`)
  console.log(`Recall@5       : ${pct(agg.recallAt5)}`)
  console.log(`MRR            : ${agg.mrr.toFixed(3)}`)
  console.log(`Avg latency    : ${Math.round(agg.avgLatency)} ms`)
  console.log(`Median latency : ${Math.round(agg.medianLatency)} ms`)
  console.log(`p95 latency    : ${Math.round(agg.p95Latency)} ms`)
  console.log('(Baseline — chunk_size=800, overlap=100, top_k=5, gemini-embedding-001)')
  console.log('')
}

async function main() {
  const args = process.argv.slice(2)
  const notes = args[0] ?? `Baseline — ${new Date().toISOString().slice(0, 10)}`

  console.log('DocuMind AI — Running retrieval evaluation…')
  console.log(`Notes: ${notes}\n`)

  const summary: EvalRunSummary = await runEvaluation(notes)

  await printSummary(summary)
}

main().catch(err => {
  console.error('Evaluation failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
