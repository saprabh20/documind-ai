'use client'

import { useState } from 'react'
import type { EvalRunDetail } from '@/types'

interface EvaluationPageProps {
  runDetail: EvalRunDetail | null
  questionCount: number
  ragConfig: {
    chunkSize: number
    chunkOverlap: number
    topK: number
    embeddingModel: string
  }
}

function pct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function ms(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${Math.round(value)} ms`
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  )
}

function KTable({ run }: { run: EvalRunDetail }) {
  const rows = [
    { k: '@1', hit: run.hitAt1, recall: run.recallAt1 },
    { k: '@3', hit: run.hitAt3, recall: run.recallAt3 },
    { k: '@5', hit: run.hitAt5 ?? 0, recall: run.recallAt5 ?? 0 },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-2 pr-6 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">K</th>
            <th className="py-2 pr-6 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Hit@K</th>
            <th className="py-2 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Recall@K</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.k} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <td className="py-2 pr-6 font-mono text-zinc-700 dark:text-zinc-300">{r.k}</td>
              <td className="py-2 pr-6 font-semibold text-zinc-900 dark:text-zinc-100">{pct(r.hit)}</td>
              <td className="py-2 font-semibold text-zinc-900 dark:text-zinc-100">{pct(r.recall)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PerQuestionTable({ run }: { run: EvalRunDetail }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 min-w-[280px]">Question</th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Hit@5</th>
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Recall@5</th>
            <th className="py-2 text-left text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">MRR</th>
          </tr>
        </thead>
        <tbody>
          {run.results.map((r, i) => (
            <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                <span className="text-xs text-zinc-400 mr-2">{i + 1}.</span>
                {r.question}
              </td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  r.hitAt5
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                }`}>
                  {r.hitAt5 ? 'Hit' : 'Miss'}
                </span>
              </td>
              <td className="py-2 pr-4 text-zinc-700 dark:text-zinc-300">
                {pct(r.recallAt5)}
              </td>
              <td className="py-2 text-zinc-700 dark:text-zinc-300">
                {r.reciprocalRank > 0 ? r.reciprocalRank.toFixed(2) : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EvaluationPage({
  runDetail,
  questionCount,
  ragConfig,
}: EvaluationPageProps) {
  const [showPerQuestion, setShowPerQuestion] = useState(false)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Retrieval Evaluation
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Retrieval quality is evaluated against a manually verified ground-truth question set.
        </p>
      </div>

      {/* Methodology note */}
      <div className="mb-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Methodology</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Each question in the evaluation dataset has one or more manually identified ground-truth
          chunk IDs — determined by locating which database chunks actually contain the expected
          answer, not by LLM inference. The evaluation runner embeds each question using
          Gemini&apos;s <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">RETRIEVAL_QUERY</code> task
          type and retrieves the top-{ragConfig.topK} chunks from pgvector. No answer generation
          is performed during evaluation.
        </p>
      </div>

      {/* Configuration */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
          Configuration
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Chunk size', value: `${ragConfig.chunkSize} tokens` },
            { label: 'Overlap', value: `${ragConfig.chunkOverlap} tokens` },
            { label: 'Top-K', value: String(ragConfig.topK) },
            { label: 'Questions', value: questionCount > 0 ? String(questionCount) : '—' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Embedding model: <code className="font-mono">{ragConfig.embeddingModel}</code>
        </p>
      </div>

      {/* No data state */}
      {!runDetail ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No evaluation data yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Run <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">npm run eval</code> to generate baseline metrics.
          </p>
        </div>
      ) : (
        <>
          {/* Run metadata */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Latest run
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {new Date(runDetail.runAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
              {runDetail.notes && <span className="ml-2 italic">{runDetail.notes}</span>}
            </span>
          </div>

          {/* Primary metric cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Hit@5" value={pct(runDetail.hitAt5)} />
            <MetricCard label="Recall@5" value={pct(runDetail.recallAt5)} />
            <MetricCard label="MRR" value={runDetail.mrr != null ? runDetail.mrr.toFixed(3) : '—'} />
            <MetricCard label="Avg latency" value={ms(runDetail.avgLatencyMs)} />
          </div>

          {/* K-breakdown table */}
          <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Hit &amp; Recall by K
            </h3>
            <KTable run={runDetail} />
          </div>

          {/* Latency detail */}
          <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Retrieval latency
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Average', value: ms(runDetail.avgLatencyMs) },
                { label: 'Median (p50)', value: ms(runDetail.medianLatencyMs) },
                { label: 'p95', value: ms(runDetail.p95LatencyMs) },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
                  <p className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-question table (collapsible) */}
          {runDetail.results.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <button
                onClick={() => setShowPerQuestion(v => !v)}
                className="flex w-full items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <span>Per-question results ({runDetail.results.length})</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${showPerQuestion ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPerQuestion && (
                <div className="mt-4">
                  <PerQuestionTable run={runDetail} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
