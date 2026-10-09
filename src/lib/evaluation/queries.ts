import { getDb } from '@/lib/db/client'
import type { EvalQuestion, EvalRun, EvalResult } from '@/types'

// ============================================================
// Row mappers
// ============================================================

function rowToQuestion(row: Record<string, unknown>): EvalQuestion {
  return {
    id: row.id as string,
    documentId: (row.document_id as string | null) ?? null,
    question: row.question as string,
    expectedChunkIds: row.expected_chunk_ids as string[],
    createdAt: row.created_at as string,
  }
}

function rowToRun(row: Record<string, unknown>): EvalRun {
  return {
    id: row.id as string,
    runAt: row.run_at as string,
    topK: row.top_k as number,
    chunkSize: row.chunk_size as number,
    chunkOverlap: row.chunk_overlap as number,
    questionCount: row.question_count as number,
    hitAt5: row.hit_at_5 as number | null,
    recallAt5: row.recall_at_5 as number | null,
    mrr: row.mrr as number | null,
    avgLatencyMs: row.avg_latency_ms as number | null,
    notes: (row.notes as string | null) ?? null,
  }
}

function rowToResult(row: Record<string, unknown>): EvalResult {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    questionId: row.question_id as string,
    retrievedChunkIds: row.retrieved_chunk_ids as string[],
    latencyMs: row.latency_ms as number,
    reciprocalRank: row.reciprocal_rank as number,
    hit: row.hit as boolean,
  }
}

// ============================================================
// Eval questions
// ============================================================

export async function listEvalQuestions(): Promise<EvalQuestion[]> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_questions')
    .select('id, document_id, question, expected_chunk_ids, created_at')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list eval questions: ${error.message}`)
  return (data as Record<string, unknown>[]).map(rowToQuestion)
}

export async function insertEvalQuestion(input: {
  documentId: string | null
  question: string
  expectedChunkIds: string[]
}): Promise<EvalQuestion> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_questions')
    .insert({
      document_id: input.documentId,
      question: input.question,
      expected_chunk_ids: input.expectedChunkIds,
    })
    .select('id, document_id, question, expected_chunk_ids, created_at')
    .single()

  if (error) throw new Error(`Failed to insert eval question: ${error.message}`)
  return rowToQuestion(data as Record<string, unknown>)
}

// ============================================================
// Eval runs
// ============================================================

export async function insertEvalRun(input: {
  topK: number
  chunkSize: number
  chunkOverlap: number
  questionCount: number
  hitAt5: number | null
  recallAt5: number | null
  mrr: number | null
  avgLatencyMs: number | null
  notes: string | null
}): Promise<EvalRun> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_runs')
    .insert({
      top_k: input.topK,
      chunk_size: input.chunkSize,
      chunk_overlap: input.chunkOverlap,
      question_count: input.questionCount,
      hit_at_5: input.hitAt5,
      recall_at_5: input.recallAt5,
      mrr: input.mrr,
      avg_latency_ms: input.avgLatencyMs,
      notes: input.notes,
    })
    .select('id, run_at, top_k, chunk_size, chunk_overlap, question_count, hit_at_5, recall_at_5, mrr, avg_latency_ms, notes')
    .single()

  if (error) throw new Error(`Failed to insert eval run: ${error.message}`)
  return rowToRun(data as Record<string, unknown>)
}

export async function updateEvalRun(
  id: string,
  metrics: {
    hitAt5: number
    recallAt5: number
    mrr: number
    avgLatencyMs: number
  },
): Promise<void> {
  const db = getDb()
  const { error } = await db
    .from('eval_runs')
    .update({
      hit_at_5: metrics.hitAt5,
      recall_at_5: metrics.recallAt5,
      mrr: metrics.mrr,
      avg_latency_ms: metrics.avgLatencyMs,
    })
    .eq('id', id)

  if (error) throw new Error(`Failed to update eval run: ${error.message}`)
}

export async function listEvalRuns(): Promise<EvalRun[]> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_runs')
    .select('id, run_at, top_k, chunk_size, chunk_overlap, question_count, hit_at_5, recall_at_5, mrr, avg_latency_ms, notes')
    .order('run_at', { ascending: false })

  if (error) throw new Error(`Failed to list eval runs: ${error.message}`)
  return (data as Record<string, unknown>[]).map(rowToRun)
}

// ============================================================
// Eval results
// ============================================================

export async function insertEvalResult(input: {
  runId: string
  questionId: string
  retrievedChunkIds: string[]
  latencyMs: number
  reciprocalRank: number
  hit: boolean
}): Promise<EvalResult> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_results')
    .insert({
      run_id: input.runId,
      question_id: input.questionId,
      retrieved_chunk_ids: input.retrievedChunkIds,
      latency_ms: input.latencyMs,
      reciprocal_rank: input.reciprocalRank,
      hit: input.hit,
    })
    .select('id, run_id, question_id, retrieved_chunk_ids, latency_ms, reciprocal_rank, hit')
    .single()

  if (error) throw new Error(`Failed to insert eval result: ${error.message}`)
  return rowToResult(data as Record<string, unknown>)
}

export async function getResultsForRun(runId: string): Promise<EvalResult[]> {
  const db = getDb()
  const { data, error } = await db
    .from('eval_results')
    .select('id, run_id, question_id, retrieved_chunk_ids, latency_ms, reciprocal_rank, hit')
    .eq('run_id', runId)
    .order('id', { ascending: true })

  if (error) throw new Error(`Failed to get eval results: ${error.message}`)
  return (data as Record<string, unknown>[]).map(rowToResult)
}
