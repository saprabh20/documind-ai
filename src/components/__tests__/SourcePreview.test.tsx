// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SourcePreview from '@/components/SourcePreview'
import type { Citation } from '@/types'

const citation: Citation = {
  chunkId: 'chunk-1',
  filename: 'guide.pdf',
  fileType: 'pdf',
  pageNumber: 7,
  passage: 'Full passage content for testing the source preview dialog.',
  similarity: 0.91,
}

afterEach(() => {
  cleanup()
})

describe('SourcePreview', () => {
  it('renders when open=true', () => {
    render(<SourcePreview citation={citation} open onClose={() => {}} />)
    expect(screen.getByText('guide.pdf')).toBeTruthy()
    expect(screen.getByText(/full passage content/i)).toBeTruthy()
    expect(screen.getByText('Page 7')).toBeTruthy()
    expect(screen.getByText(/91.*match/i)).toBeTruthy()
  })

  it('does not render when open=false', () => {
    const { container } = render(<SourcePreview citation={citation} open={false} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('closes on ESC key', () => {
    const onClose = vi.fn()
    render(<SourcePreview citation={citation} open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows passage content', () => {
    render(<SourcePreview citation={citation} open onClose={() => {}} />)
    expect(screen.getByText(citation.passage)).toBeTruthy()
  })
})
