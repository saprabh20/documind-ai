'use client'

import type { RagResponse } from '@/types'
import CitationCard from '@/components/CitationCard'

interface AnswerDisplayProps {
  result: RagResponse
}

export default function AnswerDisplay({ result }: AnswerDisplayProps) {
  if (result.cannotAnswer) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Insufficient evidence</h3>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap">{result.answer}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Answer</p>
        <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
          {result.answer}
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Retrieved {result.retrieval.chunksRetrieved} chunks in {result.retrieval.latencyMs}ms
        </div>
      </div>

      {result.citations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Sources
            <span className="ml-2 rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-400">
              {result.citations.length}
            </span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {result.citations.map((citation) => (
              <CitationCard key={citation.chunkId} citation={citation} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
