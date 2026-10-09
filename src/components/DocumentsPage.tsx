'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Document } from '@/types'
import DocumentUpload from '@/components/DocumentUpload'
import DocumentCard from '@/components/DocumentCard'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'

interface DocumentsPageProps {
  uploadEnabled: boolean
  deleteEnabled: boolean
}

export default function DocumentsPage({ uploadEnabled, deleteEnabled }: DocumentsPageProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/documents')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Document[]) => {
        if (!cancelled) setDocuments(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleUploadSuccess = useCallback((doc: Document) => {
    setDocuments((prev) => [doc, ...prev])
  }, [])

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteConfirm(id)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return
    const id = deleteConfirm
    setDeleteConfirm(null)
    setDeletingId(id)

    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      }
    } catch {
      // Deletion failed silently
    } finally {
      setDeletingId(null)
    }
  }, [deleteConfirm])

  const confirmDoc = deleteConfirm ? documents.find((d) => d.id === deleteConfirm) : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Documents</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload and manage your documents for AI-powered question answering.
        </p>
      </div>

      {uploadEnabled ? (
        <div className="mb-8">
          <DocumentUpload onSuccess={handleUploadSuccess} />
        </div>
      ) : (
        <div className="mb-8 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Document uploads are disabled in this demo deployment.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-zinc-300 dark:text-zinc-600">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">No documents yet</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {uploadEnabled ? 'Upload a document to get started.' : 'No documents have been uploaded.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              deleteEnabled={deleteEnabled}
              onDelete={handleDeleteRequest}
              deleting={deletingId === doc.id}
            />
          ))}
        </div>
      )}

      {confirmDoc && (
        <DeleteConfirmDialog
          filename={confirmDoc.filename}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
