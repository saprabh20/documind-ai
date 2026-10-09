// Shared TypeScript types for DocuMind AI.
// All database rows are returned as camelCase by the DB query layer.

// ============================================================
// Core domain types
// ============================================================

export type FileType = 'pdf' | 'txt' | 'md'

export interface Document {
  id: string
  filename: string
  fileType: FileType
  fileSizeBytes: number
  pageCount: number | null  // null for txt/md
  chunkCount: number
  createdAt: string
}

export interface DocumentChunk {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  pageNumber: number | null  // null for txt/md
  tokenCount: number
  createdAt: string
}

/** A chunk enriched with its parent document metadata and similarity score. */
export interface DocumentChunkWithSource extends DocumentChunk {
  filename: string
  fileType: FileType
  similarity: number  // cosine similarity in [0, 1]
}

// ============================================================
// RAG Q&A types
// ============================================================

export interface Citation {
  chunkId: string
  filename: string
  fileType: FileType
  pageNumber: number | null
  passage: string        // the chunk content
  similarity: number
}

export interface QuestionResponse {
  answer: string
  citations: Citation[]
  /** The full retrieval context, for transparency in the UI. */
  retrievedChunks: DocumentChunkWithSource[]
  /** True when the LLM determined the evidence was insufficient. */
  cannotAnswer: boolean
}

// ============================================================
// Ingestion types (internal to the processing pipeline)
// ============================================================

export interface ExtractedPage {
  pageNumber: number | null  // null for non-PDF files
  text: string
}

export interface TextChunk {
  content: string
  pageNumber: number | null
  tokenCount: number
  chunkIndex: number
}

export interface InsertDocumentData {
  filename: string
  fileType: FileType
  fileSizeBytes: number
  pageCount: number | null
}

export interface InsertChunkData {
  documentId: string
  chunkIndex: number
  content: string
  pageNumber: number | null
  tokenCount: number
  embedding: number[]
}

// ============================================================
// API request/response types
// ============================================================

export interface UploadResponse {
  document: Document
  chunksCreated: number
}

export interface AskRequest {
  question: string
}

// ============================================================
// Evaluation types
// ============================================================

export interface EvalQuestion {
  id: string
  documentId: string | null
  question: string
  expectedChunkIds: string[]
  createdAt: string
}

export interface EvalRun {
  id: string
  runAt: string
  topK: number
  chunkSize: number
  chunkOverlap: number
  questionCount: number
  hitAt5: number | null
  recallAt5: number | null
  mrr: number | null
  avgLatencyMs: number | null
  notes: string | null
}

export interface EvalResult {
  id: string
  runId: string
  questionId: string
  retrievedChunkIds: string[]
  latencyMs: number
  reciprocalRank: number
  hit: boolean
}

export interface EvalRunSummary extends EvalRun {
  results: EvalResult[]
}

// ============================================================
// RAG pipeline internal types
// ============================================================

/** A retrieved chunk formatted as a numbered source for the generation prompt. */
export interface RetrievedSource {
  sourceId: string          // "SOURCE_1", "SOURCE_2", etc.
  chunkId: string
  filename: string
  pageNumber: number | null
  content: string
}

/** Raw output from the generation model before citation validation. */
export interface GenerationResult {
  answer: string
  citedSourceIds: string[]  // source IDs the model referenced
  cannotAnswer: boolean
}

/** Full RAG pipeline response after retrieval, generation, and citation validation. */
export interface RagResponse {
  answer: string
  citations: Citation[]
  retrieval: {
    chunksRetrieved: number
    latencyMs: number
  }
  cannotAnswer: boolean
}

// ============================================================
// Error types
// ============================================================

export interface ApiError {
  error: string
  details?: string
}
