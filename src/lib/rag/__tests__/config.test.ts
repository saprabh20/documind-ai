import { describe, it, expect } from 'vitest'
import { RAG_CONFIG } from '@/lib/rag/config'

describe('RAG_CONFIG', () => {
  describe('chunking', () => {
    it('has a positive chunk size', () => {
      expect(RAG_CONFIG.chunkSize).toBeGreaterThan(0)
    })

    it('has a positive chunk overlap', () => {
      expect(RAG_CONFIG.chunkOverlap).toBeGreaterThan(0)
    })

    it('chunk overlap is less than chunk size', () => {
      expect(RAG_CONFIG.chunkOverlap).toBeLessThan(RAG_CONFIG.chunkSize)
    })

    it('min chunk tokens is less than chunk size', () => {
      expect(RAG_CONFIG.minChunkTokens).toBeLessThan(RAG_CONFIG.chunkSize)
    })

    it('has the expected default chunk size of 800', () => {
      expect(RAG_CONFIG.chunkSize).toBe(800)
    })

    it('has the expected default overlap of 100', () => {
      expect(RAG_CONFIG.chunkOverlap).toBe(100)
    })
  })

  describe('retrieval', () => {
    it('has a positive top-k', () => {
      expect(RAG_CONFIG.topK).toBeGreaterThan(0)
    })

    it('top-k is within a reasonable range', () => {
      expect(RAG_CONFIG.topK).toBeLessThanOrEqual(20)
    })

    it('has the expected default top-k of 5', () => {
      expect(RAG_CONFIG.topK).toBe(5)
    })
  })

  describe('embeddings', () => {
    it('embedding dimensions are 768', () => {
      expect(RAG_CONFIG.embeddingDimensions).toBe(768)
    })
  })

  describe('upload validation', () => {
    it('max file size is 4 MB', () => {
      expect(RAG_CONFIG.maxFileSizeBytes).toBe(4 * 1024 * 1024)
    })

    it('max file size is within Vercel serverless body limit (4.5 MB)', () => {
      const vercelLimit = 4.5 * 1024 * 1024
      expect(RAG_CONFIG.maxFileSizeBytes).toBeLessThan(vercelLimit)
    })

    it('allows pdf, txt, and md MIME types', () => {
      expect(RAG_CONFIG.allowedMimeTypes).toContain('application/pdf')
      expect(RAG_CONFIG.allowedMimeTypes).toContain('text/plain')
      expect(RAG_CONFIG.allowedMimeTypes).toContain('text/markdown')
    })

    it('allows .pdf, .txt, and .md extensions', () => {
      expect(RAG_CONFIG.allowedExtensions).toContain('.pdf')
      expect(RAG_CONFIG.allowedExtensions).toContain('.txt')
      expect(RAG_CONFIG.allowedExtensions).toContain('.md')
    })
  })

  describe('question answering', () => {
    it('max question length is 1000 characters', () => {
      expect(RAG_CONFIG.maxQuestionLength).toBe(1000)
    })
  })

  describe('rate limiting for embedding calls', () => {
    it('embedding delay is non-negative', () => {
      expect(RAG_CONFIG.embeddingDelayMs).toBeGreaterThanOrEqual(0)
    })

    it('max retries is a positive number', () => {
      expect(RAG_CONFIG.embeddingMaxRetries).toBeGreaterThan(0)
    })
  })
})
