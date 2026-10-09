// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import CitationCard from '@/components/CitationCard'
import type { Citation } from '@/types'

const baseCitation: Citation = {
  chunkId: 'chunk-1',
  filename: 'report.pdf',
  fileType: 'pdf',
  pageNumber: 5,
  passage: 'This is the passage content that was retrieved from the document.',
  similarity: 0.84,
}

afterEach(() => {
  cleanup()
})

describe('CitationCard', () => {
  it('renders filename', () => {
    render(<CitationCard citation={baseCitation} />)
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('renders similarity as percentage', () => {
    render(<CitationCard citation={baseCitation} />)
    expect(screen.getByText(/84.*match/i)).toBeTruthy()
  })

  it('renders page number when present', () => {
    render(<CitationCard citation={baseCitation} />)
    expect(screen.getByText('Page 5')).toBeTruthy()
  })

  it('renders dash when page number is null', () => {
    const citation: Citation = { ...baseCitation, pageNumber: null }
    render(<CitationCard citation={citation} />)
    expect(screen.getByText('Page \u2014')).toBeTruthy()
  })

  it('renders view source button', () => {
    render(<CitationCard citation={baseCitation} />)
    expect(screen.getByText('View source')).toBeTruthy()
  })
})
