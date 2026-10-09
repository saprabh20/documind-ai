import { Suspense } from 'react'
import {
  listEvalRuns,
  listEvalQuestions,
  getResultsForRun,
} from '@/lib/evaluation/queries'
import {
  aggregateMetrics,
  computePerQuestionMetrics,
  computeHitAtK,
  computeRecallAtK,
} from '@/lib/evaluation/metrics'
import { RAG_CONFIG } from '@/lib/rag/config'
import EvaluationPage from '@/components/EvaluationPage'
import type { EvalRunDetail, EvalResultForDisplay } from '@/types'

const RAG_CONFIG_FOR_DISPLAY = {
  chunkSize: RAG_CONFIG.chunkSize,
  chunkOverlap: RAG_CONFIG.chunkOverlap,
  topK: RAG_CONFIG.topK,
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
}

async function getLatestRunDetail(): Promise<EvalRunDetail | null> {
  try {
    const runs = await listEvalRuns()
    if (runs.length === 0) return null

    const latestRun = runs[0]
    const [allResults, allQuestions] = await Promise.all([
      getResultsForRun(latestRun.id),
      listEvalQuestions(),
    ])

    const questionMap = new Map(allQuestions.map(q => [q.id, q]))

    const enrichedResults = allResults.map(r => {
      const q = questionMap.get(r.questionId)
      return {
        ...r,
        question: q?.question ?? '',
        expectedChunkIds: q?.expectedChunkIds ?? [],
      }
    })

    const perQuestionMetrics = enrichedResults.map(r =>
      computePerQuestionMetrics(r.retrievedChunkIds, r.expectedChunkIds, r.latencyMs),
    )
    const agg = aggregateMetrics(perQuestionMetrics)

    const resultsForDisplay: EvalResultForDisplay[] = enrichedResults.map(r => ({
      ...r,
      hitAt5: computeHitAtK(r.retrievedChunkIds, r.expectedChunkIds, 5) === 1,
      recallAt5: computeRecallAtK(r.retrievedChunkIds, r.expectedChunkIds, 5),
    }))

    return {
      ...latestRun,
      results: resultsForDisplay,
      hitAt1: agg.hitAt1,
      hitAt3: agg.hitAt3,
      recallAt1: agg.recallAt1,
      recallAt3: agg.recallAt3,
      medianLatencyMs: agg.medianLatencyMs,
      p95LatencyMs: agg.p95LatencyMs,
    }
  } catch {
    return null
  }
}

async function getQuestionCount(): Promise<number> {
  try {
    const questions = await listEvalQuestions()
    return questions.length
  } catch {
    return 0
  }
}

// Async server component that performs DB I/O — wrapped in Suspense below.
async function EvalContent() {
  const [runDetail, questionCount] = await Promise.all([
    getLatestRunDetail(),
    getQuestionCount(),
  ])

  return (
    <EvaluationPage
      runDetail={runDetail}
      questionCount={questionCount}
      ragConfig={RAG_CONFIG_FOR_DISPLAY}
    />
  )
}

function EvalSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        <div className="mt-2 h-4 w-96 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 animate-pulse">
            <div className="h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EvaluationRoute() {
  return (
    <Suspense fallback={<EvalSkeleton />}>
      <EvalContent />
    </Suspense>
  )
}
