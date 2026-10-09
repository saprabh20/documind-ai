import { createRequire } from 'module'
import type { ExtractedPage } from '@/types'

// pdfjs-dist v6 must be imported from the legacy Node.js build and requires
// a workerSrc pointing at the bundled worker file. serverExternalPackages in
// next.config.ts ensures this import is not bundled by the Next.js bundler.
// The dynamic import is deferred so the module can be loaded in test environments
// without triggering the worker setup at module load time.
async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Use createRequire to resolve the worker's absolute path, then convert to a
  // file:// URL. The `new URL(..., import.meta.url)` approach resolves relative
  // to the calling file's location, which breaks when the bundler changes the
  // file path at runtime (e.g. Next.js builds or Vitest transforms).
  const _require = createRequire(import.meta.url)
  const workerPath = _require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`
  return pdfjs
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\0/g, '')                  // strip null bytes
    .replace(/[\x01-\x08\x0b-\x1f\x7f]/g, '') // strip control chars except \n (0x0a)
    .replace(/[^\S\n]+/g, ' ')           // collapse non-newline whitespace runs
    .trim()
}

export type ExtractionResult =
  | { ok: true; pages: ExtractedPage[] }
  | { ok: false; error: string }

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    const raw = buffer.toString('utf-8')
    const text = normalizeText(raw)
    return { ok: true, pages: [{ pageNumber: null, text }] }
  }

  if (lower.endsWith('.pdf')) {
    return extractPdf(buffer)
  }

  return { ok: false, error: `Unsupported file extension: ${filename}` }
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const pdfjs = await getPdfjs()
    const data = new Uint8Array(buffer)
    const loadingTask = pdfjs.getDocument({ data })
    const pdf = await loadingTask.promise

    const pages: ExtractedPage[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const raw = content.items
        // TextItem has a str property; TextMarkedContent does not — filter by duck typing
        .map(item => ('str' in item ? item.str : ''))
        .join(' ')
      const text = normalizeText(raw)
      pages.push({ pageNumber: i, text })
    }

    return { ok: true, pages }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `PDF extraction failed: ${message}` }
  }
}
