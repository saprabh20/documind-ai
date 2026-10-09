'use client'

import { useEffect, useRef } from 'react'
import type { Citation } from '@/types'

interface SourcePreviewProps {
  citation: Citation
  open: boolean
  onClose: () => void
}

export default function SourcePreview({ citation, open, onClose }: SourcePreviewProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const fileTypeColors: Record<string, string> = {
    pdf: 'text-rose-600 dark:text-rose-400',
    txt: 'text-sky-600 dark:text-sky-400',
    md: 'text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Source: ${citation.filename}`}
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-800 p-6 shadow-xl"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Retrieved source</p>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className={`text-xs font-bold uppercase ${fileTypeColors[citation.fileType] ?? ''}`}>
                {citation.fileType}
              </span>
              {citation.filename}
            </h2>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              {citation.pageNumber !== null && (
                <>
                  <span>Page {citation.pageNumber}</span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 font-medium text-indigo-600 dark:text-indigo-400">
                {Math.round(citation.similarity * 100)}% match
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4">
          <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-mono leading-relaxed">
            {citation.passage}
          </p>
        </div>
      </div>
    </div>
  )
}
