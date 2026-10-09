'use client'

import { useCallback, useRef, useState } from 'react'
import type { Document, UploadResponse } from '@/types'

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md']
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB

interface DocumentUploadProps {
  onSuccess: (document: Document) => void
}

export default function DocumentUpload({ onSuccess }: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (file.size === 0) return 'File is empty'
    if (file.size > MAX_FILE_SIZE) return `File too large. Maximum size is 4 MB.`
    return null
  }

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/documents', { method: 'POST', body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(body.error || `Upload failed (${res.status})`)
      }

      const data: UploadResponse = await res.json()
      onSuccess(data.document)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onSuccess])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [uploadFile])

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-zinc-300 dark:border-zinc-600 hover:border-indigo-400 dark:hover:border-indigo-500'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload document"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Uploading and processing…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Drop a file here, or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                PDF, TXT, or Markdown — up to 4 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
