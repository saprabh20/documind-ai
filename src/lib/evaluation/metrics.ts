/**
 * Retrieval evaluation metrics for the DocuMind AI RAG pipeline.
 * All functions are pure — no side effects, no I/O.
 */

// ============================================================
// Per-question metrics
// ============================================================

/**
 * Returns 1 if at least one expected chunk appears in the top K retrieved chunks,
 * otherwise 0.  K is applied to the ranked retrievedIds array (index 0 = rank 1).
 */
export function computeHitAtK(
  retrievedIds: string[],
  expectedIds: string[],
  k: number,
): 0 | 1 {
  if (expectedIds.length === 0) return 0
  const topK = retrievedIds.slice(0, k)
  const expected = new Set(expectedIds)
  return topK.some(id => expected.has(id)) ? 1 : 0
}

/**
 * Returns the fraction of expected chunks that appear in the top K retrieved chunks.
 * Range: [0, 1].  Returns 0 if expectedIds is empty.
 */
export function computeRecallAtK(
  retrievedIds: string[],
  expectedIds: string[],
  k: number,
): number {
  if (expectedIds.length === 0) return 0
  const topK = new Set(retrievedIds.slice(0, k))
  const found = expectedIds.filter(id => topK.has(id)).length
  return found / expectedIds.length
}

/**
 * Returns 1 / rank of the first relevant chunk in the retrieved list.
 * Rank is 1-indexed (first position = rank 1).
 * Returns 0 if no relevant chunk is retrieved.
 */
export function computeReciprocalRank(
  retrievedIds: string[],
  expectedIds: string[],
): number {
  if (expectedIds.length === 0) return 0
  const expected = new Set(expectedIds)
  for (let i = 0; i < retrievedIds.length; i++) {
    if (expected.has(retrievedIds[i])) {
      return 1 / (i + 1)
    }
  }
  return 0
}

export interface PerQuestionMetrics {
  hitAt1: 0 | 1
  hitAt3: 0 | 1
  hitAt5: 0 | 1
  recallAt1: number
  recallAt3: number
  recallAt5: number
  reciprocalRank: number
  latencyMs: number
}

export function computePerQuestionMetrics(
  retrievedIds: string[],
  expectedIds: string[],
  latencyMs: number,
): PerQuestionMetrics {
  return {
    hitAt1: computeHitAtK(retrievedIds, expectedIds, 1),
    hitAt3: computeHitAtK(retrievedIds, expectedIds, 3),
    hitAt5: computeHitAtK(retrievedIds, expectedIds, 5),
    recallAt1: computeRecallAtK(retrievedIds, expectedIds, 1),
    recallAt3: computeRecallAtK(retrievedIds, expectedIds, 3),
    recallAt5: computeRecallAtK(retrievedIds, expectedIds, 5),
    reciprocalRank: computeReciprocalRank(retrievedIds, expectedIds),
    latencyMs,
  }
}

// ============================================================
// Aggregate metrics
// ============================================================

export interface AggregateMetrics {
  hitAt1: number
  hitAt3: number
  hitAt5: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  avgLatencyMs: number
  medianLatencyMs: number
  /** p95 latency.  Only computed when n >= 20; otherwise equals the max latency. */
  p95LatencyMs: number
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Returns the value at the given percentile (0–1) of a pre-sorted array. */
function sortedPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(p * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export function aggregateMetrics(perQuestion: PerQuestionMetrics[]): AggregateMetrics {
  if (perQuestion.length === 0) {
    return {
      hitAt1: 0, hitAt3: 0, hitAt5: 0,
      recallAt1: 0, recallAt3: 0, recallAt5: 0,
      mrr: 0,
      avgLatencyMs: 0, medianLatencyMs: 0, p95LatencyMs: 0,
    }
  }

  const latencies = perQuestion.map(m => m.latencyMs).sort((a, b) => a - b)

  return {
    hitAt1:    mean(perQuestion.map(m => m.hitAt1)),
    hitAt3:    mean(perQuestion.map(m => m.hitAt3)),
    hitAt5:    mean(perQuestion.map(m => m.hitAt5)),
    recallAt1: mean(perQuestion.map(m => m.recallAt1)),
    recallAt3: mean(perQuestion.map(m => m.recallAt3)),
    recallAt5: mean(perQuestion.map(m => m.recallAt5)),
    mrr:       mean(perQuestion.map(m => m.reciprocalRank)),
    avgLatencyMs:    mean(latencies),
    medianLatencyMs: sortedPercentile(latencies, 0.5),
    p95LatencyMs:    perQuestion.length >= 20
      ? sortedPercentile(latencies, 0.95)
      : latencies[latencies.length - 1],
  }
}
