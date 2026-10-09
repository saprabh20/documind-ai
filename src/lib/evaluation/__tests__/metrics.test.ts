import { describe, it, expect } from 'vitest'
import {
  computeHitAtK,
  computeRecallAtK,
  computeReciprocalRank,
  computePerQuestionMetrics,
  aggregateMetrics,
} from '@/lib/evaluation/metrics'

// ============================================================
// computeHitAtK
// ============================================================

describe('computeHitAtK', () => {
  it('returns 1 when the first retrieved chunk is relevant (Hit@1)', () => {
    expect(computeHitAtK(['a', 'b', 'c'], ['a'], 1)).toBe(1)
  })

  it('returns 0 when no relevant chunk is in top 1', () => {
    expect(computeHitAtK(['x', 'b', 'a'], ['a'], 1)).toBe(0)
  })

  it('returns 1 when a relevant chunk is at rank 3 for Hit@3', () => {
    expect(computeHitAtK(['x', 'y', 'a', 'b'], ['a'], 3)).toBe(1)
  })

  it('returns 0 when relevant chunk is outside K', () => {
    expect(computeHitAtK(['x', 'y', 'z', 'a'], ['a'], 3)).toBe(0)
  })

  it('returns 1 for perfect Hit@5 when one match in top 5', () => {
    expect(computeHitAtK(['a', 'b', 'c', 'd', 'e'], ['a'], 5)).toBe(1)
  })

  it('returns 0 for failed Hit@5 when no match in top 5', () => {
    expect(computeHitAtK(['a', 'b', 'c', 'd', 'e'], ['z'], 5)).toBe(0)
  })

  it('returns 0 when expectedIds is empty', () => {
    expect(computeHitAtK(['a', 'b'], [], 5)).toBe(0)
  })

  it('returns 0 when retrievedIds is empty', () => {
    expect(computeHitAtK([], ['a'], 5)).toBe(0)
  })

  it('returns 1 when any of multiple expected IDs appears in top K', () => {
    expect(computeHitAtK(['x', 'b', 'c'], ['a', 'b'], 3)).toBe(1)
  })
})

// ============================================================
// computeRecallAtK
// ============================================================

describe('computeRecallAtK', () => {
  it('returns 1 for perfect Recall@5 (all expected found)', () => {
    expect(computeRecallAtK(['a', 'b', 'c'], ['a', 'b'], 5)).toBe(1)
  })

  it('returns 0.5 for partial Recall@5 (half expected found)', () => {
    expect(computeRecallAtK(['a', 'x', 'y'], ['a', 'b'], 5)).toBeCloseTo(0.5)
  })

  it('returns 0 when no expected chunk is retrieved', () => {
    expect(computeRecallAtK(['x', 'y', 'z'], ['a', 'b'], 5)).toBe(0)
  })

  it('returns 0 when expectedIds is empty', () => {
    expect(computeRecallAtK(['a', 'b'], [], 5)).toBe(0)
  })

  it('returns 0 when retrievedIds is empty', () => {
    expect(computeRecallAtK([], ['a'], 5)).toBe(0)
  })

  it('returns 1 for a single expected chunk that is retrieved at rank 5', () => {
    expect(computeRecallAtK(['x', 'y', 'z', 'w', 'a'], ['a'], 5)).toBe(1)
  })

  it('does not count a chunk found at rank 6 when K=5', () => {
    expect(computeRecallAtK(['x', 'y', 'z', 'w', 'v', 'a'], ['a'], 5)).toBe(0)
  })

  it('returns 1/3 when 1 of 3 expected chunks is retrieved', () => {
    expect(computeRecallAtK(['a', 'x'], ['a', 'b', 'c'], 5)).toBeCloseTo(1 / 3)
  })
})

// ============================================================
// computeReciprocalRank
// ============================================================

describe('computeReciprocalRank', () => {
  it('returns 1 when the first retrieved chunk is relevant (rank 1)', () => {
    expect(computeReciprocalRank(['a', 'b', 'c'], ['a'])).toBe(1)
  })

  it('returns 0.5 when the relevant chunk is at rank 2', () => {
    expect(computeReciprocalRank(['x', 'a', 'c'], ['a'])).toBeCloseTo(0.5)
  })

  it('returns 1/3 when the relevant chunk is at rank 3', () => {
    expect(computeReciprocalRank(['x', 'y', 'a'], ['a'])).toBeCloseTo(1 / 3)
  })

  it('returns 0 when no relevant chunk is retrieved', () => {
    expect(computeReciprocalRank(['x', 'y', 'z'], ['a'])).toBe(0)
  })

  it('returns 0 when retrievedIds is empty', () => {
    expect(computeReciprocalRank([], ['a'])).toBe(0)
  })

  it('returns 0 when expectedIds is empty', () => {
    expect(computeReciprocalRank(['a', 'b'], [])).toBe(0)
  })

  it('returns the rank of the FIRST matching chunk (not the best)', () => {
    // Both b and c are expected; b is at rank 2, c at rank 1 — first match is rank 1.
    expect(computeReciprocalRank(['c', 'b', 'x'], ['b', 'c'])).toBe(1)
  })

  it('returns 1/4 when the relevant chunk is at rank 4', () => {
    expect(computeReciprocalRank(['x', 'y', 'z', 'a'], ['a'])).toBeCloseTo(0.25)
  })
})

// ============================================================
// computePerQuestionMetrics
// ============================================================

describe('computePerQuestionMetrics', () => {
  it('computes all K variants correctly for a perfect result', () => {
    const result = computePerQuestionMetrics(['a', 'b', 'c', 'd', 'e'], ['a'], 42)
    expect(result.hitAt1).toBe(1)
    expect(result.hitAt3).toBe(1)
    expect(result.hitAt5).toBe(1)
    expect(result.recallAt1).toBe(1)
    expect(result.recallAt3).toBe(1)
    expect(result.recallAt5).toBe(1)
    expect(result.reciprocalRank).toBe(1)
    expect(result.latencyMs).toBe(42)
  })

  it('computes mixed K variants when relevant chunk is at rank 3', () => {
    const result = computePerQuestionMetrics(['x', 'y', 'a', 'b', 'c'], ['a'], 100)
    expect(result.hitAt1).toBe(0)
    expect(result.hitAt3).toBe(1)
    expect(result.hitAt5).toBe(1)
    expect(result.recallAt1).toBe(0)
    expect(result.recallAt3).toBe(1)
    expect(result.recallAt5).toBe(1)
    expect(result.reciprocalRank).toBeCloseTo(1 / 3)
  })

  it('computes failed metrics when nothing is retrieved', () => {
    const result = computePerQuestionMetrics(['x', 'y', 'z'], ['a'], 50)
    expect(result.hitAt5).toBe(0)
    expect(result.recallAt5).toBe(0)
    expect(result.reciprocalRank).toBe(0)
  })
})

// ============================================================
// aggregateMetrics
// ============================================================

describe('aggregateMetrics', () => {
  it('returns all-zero aggregates for an empty dataset', () => {
    const agg = aggregateMetrics([])
    expect(agg.hitAt5).toBe(0)
    expect(agg.recallAt5).toBe(0)
    expect(agg.mrr).toBe(0)
    expect(agg.avgLatencyMs).toBe(0)
    expect(agg.medianLatencyMs).toBe(0)
    expect(agg.p95LatencyMs).toBe(0)
  })

  it('computes correct mean Hit@5 across multiple questions', () => {
    const metrics = [
      computePerQuestionMetrics(['a'], ['a'], 100),  // hit
      computePerQuestionMetrics(['x'], ['a'], 200),  // miss
      computePerQuestionMetrics(['a'], ['a'], 150),  // hit
      computePerQuestionMetrics(['x'], ['a'], 180),  // miss
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.hitAt5).toBeCloseTo(0.5)
  })

  it('computes correct MRR across multiple questions', () => {
    const metrics = [
      computePerQuestionMetrics(['a', 'b'], ['a'], 100),  // RR = 1
      computePerQuestionMetrics(['x', 'a'], ['a'], 100),  // RR = 0.5
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.mrr).toBeCloseTo(0.75)
  })

  it('computes correct average latency', () => {
    const metrics = [
      computePerQuestionMetrics(['a'], ['a'], 100),
      computePerQuestionMetrics(['a'], ['a'], 300),
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.avgLatencyMs).toBeCloseTo(200)
  })

  it('computes median latency correctly for an odd-length array', () => {
    const metrics = [
      computePerQuestionMetrics(['a'], ['a'], 100),
      computePerQuestionMetrics(['a'], ['a'], 200),
      computePerQuestionMetrics(['a'], ['a'], 300),
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.medianLatencyMs).toBe(200)
  })

  it('uses max latency as p95 when fewer than 20 questions', () => {
    const metrics = [
      computePerQuestionMetrics(['a'], ['a'], 100),
      computePerQuestionMetrics(['a'], ['a'], 500),
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.p95LatencyMs).toBe(500)
  })

  it('computes all six K-metric means correctly', () => {
    // q1: relevant at rank 1 → all hits, all recalls = 1
    // q2: relevant at rank 4 → hit@1=0, hit@3=0, hit@5=1; recall same
    const metrics = [
      computePerQuestionMetrics(['a', 'b', 'c', 'd', 'e'], ['a'], 50),
      computePerQuestionMetrics(['x', 'y', 'z', 'a', 'e'], ['a'], 50),
    ]
    const agg = aggregateMetrics(metrics)
    expect(agg.hitAt1).toBeCloseTo(0.5)
    expect(agg.hitAt3).toBeCloseTo(0.5)
    expect(agg.hitAt5).toBeCloseTo(1.0)
    expect(agg.recallAt1).toBeCloseTo(0.5)
    expect(agg.recallAt3).toBeCloseTo(0.5)
    expect(agg.recallAt5).toBeCloseTo(1.0)
  })
})
