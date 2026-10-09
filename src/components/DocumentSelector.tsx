'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Document } from '@/types'

interface DocumentSelectorProps {
  documents: Document[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export default function DocumentSelector({ documents, selectedIds, onChange }: DocumentSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDoc = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }, [selectedIds, onChange])

  const label =
    selectedIds.length === 0
      ? 'All documents'
      : `${selectedIds.length} document${selectedIds.length === 1 ? '' : 's'} selected`

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{label}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg" role="listbox">
          {documents.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500">No documents available</p>
          ) : (
            documents.map((doc) => (
              <label
                key={doc.id}
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(doc.id)}
                  onChange={() => toggleDoc(doc.id)}
                  className="rounded border-zinc-300 text-indigo-600"
                />
                <span className="truncate">{doc.filename}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
