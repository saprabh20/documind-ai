// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentsPage from '@/components/DocumentsPage'
import type { Document } from '@/types'

const mockDocument: Document = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  filename: 'test-doc.pdf',
  fileType: 'pdf',
  fileSizeBytes: 1234567,
  pageCount: 12,
  chunkCount: 8,
  createdAt: '2026-01-15T10:00:00Z',
}

const mockDocument2: Document = {
  id: '223e4567-e89b-12d3-a456-426614174001',
  filename: 'notes.txt',
  fileType: 'txt',
  fileSizeBytes: 4567,
  pageCount: null,
  chunkCount: 3,
  createdAt: '2026-01-16T10:00:00Z',
}

function mockFetchSuccess(docs: Document[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(docs),
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('DocumentsPage', () => {
  it('renders loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<DocumentsPage uploadEnabled deleteEnabled />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders document list after fetch', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess([mockDocument, mockDocument2]))
    render(<DocumentsPage uploadEnabled deleteEnabled />)

    await waitFor(() => {
      expect(screen.getByText('test-doc.pdf')).toBeTruthy()
      expect(screen.getByText('notes.txt')).toBeTruthy()
    })
  })

  it('renders empty state when no documents', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess([]))
    render(<DocumentsPage uploadEnabled deleteEnabled />)

    await waitFor(() => {
      expect(screen.getByText('No documents yet')).toBeTruthy()
    })
  })

  it('shows demo notice when upload disabled', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess([]))
    render(<DocumentsPage uploadEnabled={false} deleteEnabled />)

    await waitFor(() => {
      expect(screen.getByText(/uploads are disabled/i)).toBeTruthy()
    })
  })

  it('hides delete button when delete disabled', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess([mockDocument]))
    render(<DocumentsPage uploadEnabled deleteEnabled={false} />)

    await waitFor(() => {
      expect(screen.getByText('test-doc.pdf')).toBeTruthy()
    })

    const deleteBtn = screen.queryByLabelText(/delete/i)
    expect(deleteBtn).toBeNull()
  })

  it('triggers confirm dialog on delete button click', async () => {
    vi.stubGlobal('fetch', mockFetchSuccess([mockDocument]))
    const user = userEvent.setup()
    render(<DocumentsPage uploadEnabled deleteEnabled />)

    await waitFor(() => {
      expect(screen.getByText('test-doc.pdf')).toBeTruthy()
    })

    const deleteBtn = screen.getByLabelText('Delete test-doc.pdf')
    await user.click(deleteBtn)

    expect(screen.getByText('Delete document')).toBeTruthy()
    expect(screen.getByText(/are you sure/i)).toBeTruthy()
  })
})
