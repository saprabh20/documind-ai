// RAG pipeline configuration constants.
//
// All tunable values live here. Changing these affects chunking, retrieval,
// and ingestion behavior globally. Run the evaluation framework after any
// change to measure the impact.
//
// Model identifiers are NOT here — they come from environment variables
// via src/lib/env.ts to allow changing them without code deploys.

export const RAG_CONFIG = {
  // ---- Chunking ----
  /** Target size of each text chunk in approximate tokens. */
  chunkSize: 800,

  /** Number of overlapping tokens between consecutive chunks.
   *  Must be less than chunkSize. */
  chunkOverlap: 100,

  /** Minimum token count for the trailing chunk of a document.
   *  If the last chunk is smaller than this, it is merged into the
   *  previous chunk rather than stored as a near-empty fragment. */
  minChunkTokens: 50,

  // ---- Retrieval ----
  /** Number of chunks to retrieve per query (top-k). */
  topK: 5,

  // ---- Embeddings ----
  /** Must match the vector(N) dimension in the database schema.
   *  Changing this requires re-running all embeddings and a schema migration. */
  embeddingDimensions: 768,

  // ---- Ingestion rate limiting ----
  /** Milliseconds to wait between consecutive embedding API calls.
   *  The Gemini free tier has a low requests-per-minute limit for embeddings. */
  embeddingDelayMs: 200,

  /** Maximum retry attempts on HTTP 429 (Too Many Requests). */
  embeddingMaxRetries: 3,

  /** Base delay in milliseconds for the first retry (doubles each attempt). */
  embeddingRetryBaseMs: 1000,

  // ---- Upload validation ----
  /** Maximum allowed file size in bytes (4 MB — within Vercel's 4.5 MB limit). */
  maxFileSizeBytes: 4 * 1024 * 1024,

  /** Allowed file MIME types. */
  allowedMimeTypes: ['application/pdf', 'text/plain', 'text/markdown'] as const,

  /** Allowed file extensions (must match MIME type). */
  allowedExtensions: ['.pdf', '.txt', '.md'] as const,

  // ---- Question answering ----
  /** Maximum length of a user question in characters. */
  maxQuestionLength: 1000,
} as const

export type AllowedMimeType = (typeof RAG_CONFIG.allowedMimeTypes)[number]
export type AllowedExtension = (typeof RAG_CONFIG.allowedExtensions)[number]
