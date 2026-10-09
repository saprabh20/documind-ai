'use client'

import { useEffect, useRef } from 'react'

interface DeleteConfirmDialogProps {
  filename: string
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmDialog({ filename, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
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
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${filename}`}
        className="relative z-10 w-full max-w-sm rounded-xl bg-white dark:bg-zinc-800 p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Delete document</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Are you sure you want to delete <span className="font-medium text-zinc-900 dark:text-zinc-100">{filename}</span>?
          This will remove the document and all its chunks. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
