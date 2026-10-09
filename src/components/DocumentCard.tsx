'use client'

import type { Document } from '@/types'

function FileTypeIcon({ fileType }: { fileType: Document['fileType'] }) {
  const colors: Record<string, string> = {
    pdf: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
    txt: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
    md: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  }

  return (
    <div className={`flex items-center justify-center h-10 w-10 rounded-lg text-xs font-bold uppercase ${colors[fileType]}`}>
      {fileType}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface DocumentCardProps {
  document: Document
  deleteEnabled: boolean
  onDelete: (id: string) => void
  deleting: boolean
}

export default function DocumentCard({ document, deleteEnabled, onDelete, deleting }: DocumentCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 transition-shadow hover:shadow-sm">
      <FileTypeIcon fileType={document.fileType} />

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={document.filename}>
          {document.filename}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatFileSize(document.fileSizeBytes)}</span>
          {document.pageCount !== null && (
            <>
              <span aria-hidden>·</span>
              <span>{document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span>{document.chunkCount} {document.chunkCount === 1 ? 'chunk' : 'chunks'} indexed</span>
          <span aria-hidden>·</span>
          <span>{formatDate(document.createdAt)}</span>
        </div>
      </div>

      {deleteEnabled && (
        <button
          onClick={() => onDelete(document.id)}
          disabled={deleting}
          className="shrink-0 rounded-lg p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          aria-label={`Delete ${document.filename}`}
        >
          {deleting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-red-600" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
