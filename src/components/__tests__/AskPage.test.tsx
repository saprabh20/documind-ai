// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AskPage from '@/components/AskPage'
import type { RagResponse } from '@/types'

const mockRagResponse: RagResponse = {
  answer: 'The answer is 42.',
  citations: [
    {
      chunkId: 'chunk-1',
      filename: 'guide.pdf',
      fileType: 'pdf',
      pageNumber: 3,
      passage: 'The answer to life, the universe, and everything is 42.',
      similarity: 0.92,
    },
  ],
  retrieval: { chunksRetrieved: 5, latencyMs: 120 },
  cannotAnswer: false,
}

const cannotAnswerResponse: RagResponse = {
  answer: 'I cannot find sufficient evidence to answer this question.',
  citations: [],
  retrieval: { chunksRetrieved: 5, latencyMs: 80 },
  cannotAnswer: true,
}

function mockFetchForAsk(questionResponse: { ok: boolean; status: number; body: unknown }) {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/api/documents')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
    }
    if (opts?.method === 'POST') {
      return Promise.resolve({
        ok: questionResponse.ok,
        status: questionResponse.status,
        json: () => Promise.resolve(questionResponse.body),
      })
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) })
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AskPage', () => {
  it('disables submit button when question is empty', () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: true, status: 200, body: mockRagResponse }))
    render(<AskPage />)
    const button = screen.getByRole('button', { name: /ask/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('renders answer text on successful response', async () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: true, status: 200, body: mockRagResponse }))
    const user = userEvent.setup()
    render(<AskPage />)

    const textarea = screen.getByPlaceholderText(/what would you like/i)
    await user.type(textarea, 'What is the meaning of life?')
    await user.click(screen.getByRole('button', { name: /ask/i }))

    await waitFor(() => {
      expect(screen.getByText('The answer is 42.')).toBeTruthy()
    })
  })

  it('renders insufficient evidence on cannotAnswer', async () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: true, status: 200, body: cannotAnswerResponse }))
    const user = userEvent.setup()
    render(<AskPage />)

    const textarea = screen.getByPlaceholderText(/what would you like/i)
    await user.type(textarea, 'Unknown question')
    await user.click(screen.getByRole('button', { name: /ask/i }))

    await waitFor(() => {
      expect(screen.getByText('Insufficient evidence')).toBeTruthy()
    })
  })

  it('shows unavailable message on HTTP 503', async () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: false, status: 503, body: { error: 'unavailable' } }))
    const user = userEvent.setup()
    render(<AskPage />)

    const textarea = screen.getByPlaceholderText(/what would you like/i)
    await user.type(textarea, 'Any question')
    await user.click(screen.getByRole('button', { name: /ask/i }))

    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeTruthy()
    })
  })

  it('renders citations when present', async () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: true, status: 200, body: mockRagResponse }))
    const user = userEvent.setup()
    render(<AskPage />)

    const textarea = screen.getByPlaceholderText(/what would you like/i)
    await user.type(textarea, 'What is 42?')
    await user.click(screen.getByRole('button', { name: /ask/i }))

    await waitFor(() => {
      expect(screen.getByText('guide.pdf')).toBeTruthy()
      expect(screen.getByText(/92.*match/i)).toBeTruthy()
      expect(screen.getByText('Page 3')).toBeTruthy()
    })
  })

  it('renders document filtering UI', async () => {
    vi.stubGlobal('fetch', mockFetchForAsk({ ok: true, status: 200, body: mockRagResponse }))
    render(<AskPage />)
    await waitFor(() => {
      expect(screen.getByText('All documents')).toBeTruthy()
    })
  })
})
