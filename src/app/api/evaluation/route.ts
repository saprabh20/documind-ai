import { NextResponse } from 'next/server'
import {
  listEvalRuns,
  listEvalQuestions,
  getResultsForRun,
} from '@/lib/evaluation/queries'
import {
  computeHitAtK,
  computeRecallAtK,
  aggregateMetrics,
  computePerQuestionMetrics,
} from '@/lib/evaluation/metrics'
import type { EvalRunDetail, EvalResultForDisplay, ApiError } from '@/types'

/**
 * GET /api/evaluation
 *
 * Returns the latest completed evaluation run enriched with per-K metrics
 * computed from the stored eval_results.  Read-only — does NOT trigger a run.
 *
 * Returns null in the data field when no runs exist yet.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const runs = await listEvalRuns()
    if (runs.length === 0) {
      return NextResponse.json({ data: null })
    }

    const latestRun = runs[0]
    const [allResults, allQuestions] = await Promise.all([
      getResultsForRun(latestRun.id),
      listEvalQuestions(),
    ])

    const questionMap = new Map(allQuestions.map(q => [q.id, q]))

    // Build enriched results.
    const enrichedResults = allResults.map(r => {
      const q = questionMap.get(r.questionId)
      return {
        ...r,
        question: q?.question ?? '',
        expectedChunkIds: q?.expectedChunkIds ?? [],
      }
    })

    // Compute aggregate multi-K metrics from enriched results.
    const perQuestionMetrics = enrichedResults.map(r =>
      computePerQuestionMetrics(r.retrievedChunkIds, r.expectedChunkIds, r.latencyMs),
    )
    const agg = aggregateMetrics(perQuestionMetrics)

    // Per-question display metrics.
    const resultsForDisplay: EvalResultForDisplay[] = enrichedResults.map(r => ({
      ...r,
      hitAt5: computeHitAtK(r.retrievedChunkIds, r.expectedChunkIds, 5) === 1,
      recallAt5: computeRecallAtK(r.retrievedChunkIds, r.expectedChunkIds, 5),
    }))

    const detail: EvalRunDetail = {
      ...latestRun,
      results: resultsForDisplay,
      hitAt1: agg.hitAt1,
      hitAt3: agg.hitAt3,
      recallAt1: agg.recallAt1,
      recallAt3: agg.recallAt3,
      medianLatencyMs: agg.medianLatencyMs,
      p95LatencyMs: agg.p95LatencyMs,
    }

    return NextResponse.json({ data: detail })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message } satisfies ApiError, { status: 500 })
  }
}
