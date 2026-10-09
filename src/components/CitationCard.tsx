'use client'

import { useState } from 'react'
import type { Citation } from '@/types'
import SourcePreview from '@/components/SourcePreview'

interface CitationCardProps {
  citation: Citation
}

const fileTypeColors: Record<string, string> = {
  pdf: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  txt: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  md: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
}

export default function CitationCard({ citation }: CitationCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const preview = citation.passage.length > 150
    ? citation.passage.slice(0, 150) + '...'
    : citation.passage

  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold uppercase ${fileTypeColors[citation.fileType] ?? ''}`}>
              {citation.fileType}
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {citation.filename}
            </span>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
            {Math.round(citation.similarity * 100)}% match
          </span>
        </div>

        <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          {citation.pageNumber !== null ? `Page ${citation.pageNumber}` : 'Page —'}
        </div>

        <p className="mt-2 rounded-md bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
          {preview}
        </p>

        <button
          onClick={() => setPreviewOpen(true)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          View source
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <SourcePreview
        citation={citation}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  )
}
