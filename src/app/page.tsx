import { Suspense } from 'react'
import Link from 'next/link'
import { listDocuments } from '@/lib/db/documents'

async function StatsSection() {
  let totalDocs = 0
  let totalChunks = 0

  try {
    const documents = await listDocuments()
    totalDocs = documents.length
    totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0)
  } catch {
    // DB unavailable — show zeros
  }

  return (
    <div className="mb-10 grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totalDocs}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Documents</p>
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
        <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totalChunks}</p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Indexed chunks</p>
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="mb-10 grid grid-cols-2 gap-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 animate-pulse">
        <div className="h-9 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="mt-2 h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 animate-pulse">
        <div className="h-9 w-12 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="mt-2 h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
    </div>
  )
}

const steps = [
  { num: '1', title: 'Upload', desc: 'Upload PDF, TXT, or Markdown documents.' },
  { num: '2', title: 'Index', desc: 'Documents are chunked and embedded with Gemini.' },
  { num: '3', title: 'Ask', desc: 'Ask questions in natural language.' },
  { num: '4', title: 'Answer', desc: 'Get grounded answers with cited sources.' },
]

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">DocuMind AI</h1>
        <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
          Upload documents. Ask questions. Get grounded, cited answers.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-1">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Knowledge base</h2>
      </div>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      {/* Quick actions */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Quick actions</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/documents"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Upload Document
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Add new documents to your knowledge base.</p>
          </Link>

          <Link
            href="/ask"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Ask a Question
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Get AI-powered answers from your documents.</p>
          </Link>

          <Link
            href="/documents"
            className="group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Browse Documents
            </h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">View and manage your uploaded documents.</p>
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-bold mb-3">
                {step.num}
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
