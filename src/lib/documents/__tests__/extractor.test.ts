import { describe, it, expect } from 'vitest'
import { extractText } from '@/lib/documents/extractor'

// Minimal valid single-page PDF (no text content, but structurally valid)
const MINIMAL_PDF = Buffer.from(
  '%PDF-1.0\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
  '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
  'xref\n0 4\n' +
  '0000000000 65535 f\n' +
  '0000000009 00000 n\n' +
  '0000000058 00000 n\n' +
  '0000000115 00000 n\n' +
  'trailer<</Size 4/Root 1 0 R>>\n' +
  'startxref\n190\n%%EOF',
)

describe('extractText', () => {
  describe('TXT extraction', () => {
    it('extracts plain text as a single page with null pageNumber', async () => {
      const buf = Buffer.from('Hello world\nThis is a test.')
      const result = await extractText(buf, 'doc.txt')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNumber).toBeNull()
      expect(result.pages[0].text).toContain('Hello world')
    })

    it('normalizes whitespace in TXT', async () => {
      const buf = Buffer.from('Hello   world\t\t\tfoo')
      const result = await extractText(buf, 'doc.txt')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages[0].text).toBe('Hello world foo')
    })

    it('strips null bytes and control chars from TXT', async () => {
      const buf = Buffer.from('Hello\x00\x01\x02world')
      const result = await extractText(buf, 'doc.txt')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages[0].text).not.toContain('\x00')
      expect(result.pages[0].text).not.toContain('\x01')
    })
  })

  describe('Markdown extraction', () => {
    it('extracts markdown as a single page with null pageNumber', async () => {
      const buf = Buffer.from('# Title\n\nSome **bold** text.')
      const result = await extractText(buf, 'README.md')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNumber).toBeNull()
      expect(result.pages[0].text).toContain('Title')
    })
  })

  describe('PDF extraction', () => {
    it('returns ok:true for a minimal valid PDF with 1 page', async () => {
      const result = await extractText(MINIMAL_PDF, 'test.pdf')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].pageNumber).toBe(1)
    })

    it('returns ok:false for a malformed PDF buffer', async () => {
      const corrupt = Buffer.from('this is not a pdf at all !!!!')
      const result = await extractText(corrupt, 'bad.pdf')

      expect(result.ok).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('returns ok:true with empty text for an empty TXT file', async () => {
      const buf = Buffer.from('')
      const result = await extractText(buf, 'empty.txt')

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].text).toBe('')
    })

    it('returns ok:false for an unsupported extension', async () => {
      const buf = Buffer.from('some content')
      const result = await extractText(buf, 'document.docx')

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toContain('Unsupported')
    })
  })
})
