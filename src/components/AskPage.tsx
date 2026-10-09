'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Document, RagResponse } from '@/types'
import DocumentSelector from '@/components/DocumentSelector'
import AnswerDisplay from '@/components/AnswerDisplay'

type LoadingState = 'idle' | 'searching' | 'generating'

const SUGGESTED_QUESTIONS = [
  'How many days of PTO do employees receive per year?',
  'What are the rate limits for the Meridian API free tier?',
  'What is the maximum file upload size on the Aurora Platform?',
  'What is the parental leave policy?',
  'How does webhook authentication work in Meridian?',
]

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [documentList, setDocumentList] = useState<Document[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [result, setResult] = useState<RagResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/documents')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Document[]) => setDocumentList(data))
      .catch(() => setDocumentList([]))
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = question.trim()
    if (!trimmed) return

    if (trimmed.length > 1000) {
      setError('Question must be at most 1000 characters.')
      return
    }

    setError(null)
    setResult(null)
    setLoadingState('searching')

    timerRef.current = setTimeout(() => {
      setLoadingState('generating')
    }, 1500)

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
      })

      if (timerRef.current) clearTimeout(timerRef.current)

      if (res.status === 503) {
        setError('AI generation is temporarily unavailable. Please try again shortly.')
        setLoadingState('idle')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Something went wrong' }))
        setError(body.error || 'Something went wrong. Please try again.')
        setLoadingState('idle')
        return
      }

      const data: RagResponse = await res.json()
      setResult(data)
    } catch {
      if (timerRef.current) clearTimeout(timerRef.current)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingState('idle')
    }
  }, [question, selectedDocIds])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Ask AI</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Ask questions about your uploaded documents. Answers are grounded in retrieved evidence.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
          Try asking
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuestion(q)}
              className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What would you like to know about your documents?"
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors resize-none"
          />
          <div className="mt-1 text-xs text-zinc-400 text-right">{question.length}/1000</div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Filter by document (optional)
          </label>
          <DocumentSelector
            documents={documentList}
            selectedIds={selectedDocIds}
            onChange={setSelectedDocIds}
          />
        </div>

        <button
          type="submit"
          disabled={loadingState !== 'idle' || !question.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingState !== 'idle' && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          {loadingState === 'idle' ? 'Ask' : loadingState === 'searching' ? 'Searching...' : 'Generating...'}
        </button>
      </form>

      {loadingState !== 'idle' && (
        <div className="mt-8 flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" />
          {loadingState === 'searching'
            ? 'Searching your documents...'
            : 'Generating a grounded answer...'}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8">
          <AnswerDisplay result={result} />
        </div>
      )}
    </div>
  )
}
