import { retrieveChunks } from '@/lib/rag/retrieval'
import { RAG_CONFIG } from '@/lib/rag/config'
import {
  listEvalQuestions,
  insertEvalRun,
  updateEvalRun,
  insertEvalResult,
  getResultsForRun,
} from '@/lib/evaluation/queries'
import {
  computePerQuestionMetrics,
  aggregateMetrics,
  type PerQuestionMetrics,
} from '@/lib/evaluation/metrics'
import type { EvalRunSummary } from '@/types'

/**
 * Runs the full retrieval evaluation against all eval_questions in the database.
 *
 * - Uses the real Gemini embedding API (RETRIEVAL_QUERY).
 * - Uses the real pgvector similarity search.
 * - Does NOT call Gemini answer generation.
 * - Stores an eval_run row and one eval_result row per question.
 * - Returns the completed run summary.
 *
 * Intended to be called from scripts/run-evaluation.ts, NOT from a public HTTP handler.
 */
export async function runEvaluation(notes?: string): Promise<EvalRunSummary> {
  const questions = await listEvalQuestions()
  if (questions.length === 0) {
    throw new Error(
      'No evaluation questions found. Run scripts/seed-eval-dataset.ts first.',
    )
  }

  // Create the run row up-front so we have an ID for result rows.
  const run = await insertEvalRun({
    topK: RAG_CONFIG.topK,
    chunkSize: RAG_CONFIG.chunkSize,
    chunkOverlap: RAG_CONFIG.chunkOverlap,
    questionCount: questions.length,
    hitAt5: null,
    recallAt5: null,
    mrr: null,
    avgLatencyMs: null,
    notes: notes ?? null,
  })

  const perQuestionMetrics: PerQuestionMetrics[] = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]

    // Retrieve — only embedding + vector search, no generation.
    const { chunks, latencyMs } = await retrieveChunks(q.question)
    const retrievedIds = chunks.map(c => c.id)

    const metrics = computePerQuestionMetrics(
      retrievedIds,
      q.expectedChunkIds,
      latencyMs,
    )
    perQuestionMetrics.push(metrics)

    await insertEvalResult({
      runId: run.id,
      questionId: q.id,
      retrievedChunkIds: retrievedIds,
      latencyMs,
      reciprocalRank: metrics.reciprocalRank,
      hit: metrics.hitAt5 === 1,
    })

    // Small delay to stay within free-tier rate limits.
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RAG_CONFIG.embeddingDelayMs))
    }
  }

  // Aggregate and persist.
  const agg = aggregateMetrics(perQuestionMetrics)
  await updateEvalRun(run.id, {
    hitAt5: agg.hitAt5,
    recallAt5: agg.recallAt5,
    mrr: agg.mrr,
    avgLatencyMs: agg.avgLatencyMs,
  })

  const results = await getResultsForRun(run.id)
  return {
    ...run,
    hitAt5: agg.hitAt5,
    recallAt5: agg.recallAt5,
    mrr: agg.mrr,
    avgLatencyMs: agg.avgLatencyMs,
    results,
  }
}
