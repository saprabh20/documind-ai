# RAG Pipeline — DocuMind AI

## Overview

DocuMind AI implements Retrieval-Augmented Generation (RAG) in two distinct phases:

1. **Ingestion** — documents are processed offline and stored as searchable embeddings
2. **Retrieval + Generation** — at query time, relevant chunks are retrieved and fed to the LLM

The LLM never sees entire documents. It only sees the top-k retrieved passages.

---

## Phase 1: Document Ingestion

### 1.1 Text Extraction

Module: `src/lib/documents/extractor.ts`

| File Type | Library | Page Numbers |
|---|---|---|
| PDF | `pdfjs-dist` | Yes — per-page |
| TXT | Node.js `Buffer` | No |
| MD | Node.js `Buffer` | No |

PDF extraction produces an array of `{ pageNumber: number, text: string }` objects. TXT and MD are treated as a single page (page_number = null).

Normalization applied after extraction:
- Collapse runs of whitespace to single spaces
- Strip null bytes and control characters (except newlines)
- Trim leading/trailing whitespace per page

### 1.2 Chunking

Module: `src/lib/rag/chunker.ts`

Algorithm: sliding window over the normalized text with configurable size and overlap.

```
Configuration (src/lib/rag/config.ts):
  CHUNK_SIZE    = 800   (tokens)
  CHUNK_OVERLAP = 100   (tokens)
  TOP_K         = 5
```

Token counting uses a simple approximation: `Math.ceil(text.length / 4)`. This approximates GPT-2/Gemini tokenization for English text without requiring a tokenizer library. The approximation is acceptable because chunk boundaries are soft — slight over/under counting does not affect retrieval quality meaningfully.

Chunking procedure:
1. Convert normalized text to a token array using the approximation.
2. Slide a window of `CHUNK_SIZE` tokens, advancing `CHUNK_SIZE - CHUNK_OVERLAP` tokens per step.
3. For PDF inputs, track the source page number for each chunk based on where in the text it originated.
4. Record `{ content, pageNumber, tokenCount }` for each chunk.

Edge case: if the final chunk would be fewer than 50 tokens, merge it with the previous chunk rather than creating a near-empty trailing chunk.

### 1.3 Embedding Generation

Module: `src/lib/gemini/embeddings.ts`

**`gemini-embedding-001` supports `taskType` — use it:**

- **Document chunks** (ingestion): `taskType: 'RETRIEVAL_DOCUMENT'`
- **Queries** (retrieval): `taskType: 'RETRIEVAL_QUERY'`

Using the correct task type improves retrieval quality. Both use the same model and `outputDimensionality`.
Do NOT use text prefixes — those were a workaround specific to `gemini-embedding-2` GA.

```typescript
// Document chunk embedding (ingestion)
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001'
const response = await ai.models.embedContent({
  model: embeddingModel,
  contents: chunk.content,
  config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 768 },
})

// Query embedding (retrieval)
const response = await ai.models.embedContent({
  model: embeddingModel,
  contents: question,
  config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 },
})
```

Rate limit handling:
- Free tier: up to 10M tokens/min
- Introduce a delay between consecutive embedding calls (200 ms) to stay within RPM limits
- On 429 errors, retry with exponential backoff (max 3 retries)

### 1.4 Storage

Module: `src/lib/documents/processor.ts`

Ingestion is atomic per document:
1. Insert `documents` row → get `documentId`
2. For each chunk: embed + insert `document_chunks` row
3. Update `documents.chunk_count`

On any failure after step 1, delete the partially inserted document row (cascade will remove chunks). This prevents orphaned partial documents.

---

## Phase 2: Retrieval + Generation

### 2.1 Query Embedding

Module: `src/lib/gemini/embeddings.ts`

The user's question is embedded with the same model and dimensions as document chunks.
Use `taskType: 'RETRIEVAL_QUERY'` for `gemini-embedding-001`:

```typescript
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001'
const response = await ai.models.embedContent({
  model: embeddingModel,
  contents: question,
  config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 768 },
})
```

### 2.2 Vector Similarity Search

Module: `src/lib/rag/retrieval.ts`

Uses pgvector cosine distance (`<=>`) via parameterized SQL:

```sql
SELECT dc.id, dc.content, dc.page_number, dc.token_count,
       d.filename, d.file_type,
       1 - (dc.embedding <=> $1::vector) AS similarity
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE dc.embedding IS NOT NULL
ORDER BY dc.embedding <=> $1::vector
LIMIT $2
```

Returns top-k chunks sorted by descending similarity.

### 2.3 Context Assembly

Module: `src/lib/rag/pipeline.ts`

Retrieved chunks are formatted as a numbered list for the prompt:

```
[SOURCE 1] ID: <uuid> | File: report.pdf | Page: 3
<chunk content>

[SOURCE 2] ID: <uuid> | File: notes.txt | Page: —
<chunk content>

...
```

The chunk IDs are embedded in the prompt so the LLM can reference them in citations.

### 2.4 Answer Generation

Module: `src/lib/gemini/generation.ts`

Model: read from `process.env.GEMINI_GENERATION_MODEL` (default: `gemini-3.8-flash`)

Prompt structure:

```
SYSTEM:
You are a document analysis assistant. Answer questions using ONLY
the provided source passages below. Do not use outside knowledge.

Rules:
1. Base every claim on a specific source passage.
2. Cite sources using their exact ID in the format [SOURCE:<uuid>].
3. If the passages do not contain enough information to answer,
   respond: "I cannot answer this question confidently from the
   provided documents."
4. Do not invent file names, page numbers, or source IDs.

--- BEGIN UNTRUSTED DOCUMENT CONTENT ---
<context with source IDs>
--- END UNTRUSTED DOCUMENT CONTENT ---

USER:
<question>
```

The "UNTRUSTED DOCUMENT CONTENT" delimiters are a prompt injection defense measure.

### 2.5 Citation Extraction and Validation

Module: `src/lib/rag/pipeline.ts`

After generation:
1. Parse the LLM response for all `[SOURCE:<uuid>]` patterns.
2. For each cited UUID, check whether it appears in the set of retrieved chunk IDs.
3. Discard any UUID that does not match a retrieved chunk.
4. For valid UUIDs, look up metadata from the retrieved chunks (filename, page number, passage content).

If after validation no valid citations remain:
- Return the answer with an empty citations array and a warning flag.
- The UI displays a "no verifiable sources" notice.

If the LLM returned "cannot answer," return the answer with empty citations and no warning.

### 2.6 Response Shape

```typescript
type QuestionResponse = {
  answer: string;
  citations: Citation[];
  retrievedChunks: ChunkMetadata[];  // full retrieval context for transparency
  cannotAnswer: boolean;
};

type Citation = {
  chunkId: string;
  filename: string;
  fileType: string;
  pageNumber: number | null;
  passage: string;           // the actual chunk text
  similarity: number;        // cosine similarity score
};
```

---

## Configuration

All tunable constants live in `src/lib/rag/config.ts`:

```typescript
// src/lib/rag/config.ts — static constants
export const RAG_CONFIG = {
  chunkSize: 800,           // approximate tokens per chunk
  chunkOverlap: 100,        // token overlap between consecutive chunks
  topK: 5,                  // number of chunks to retrieve
  embeddingDimensions: 768, // must match vector(N) in DB schema
  maxQuestionLength: 1000,
  embeddingDelayMs: 200,    // delay between embedding API calls
}

// Model names are NOT in RAG_CONFIG — they come from environment variables:
//   process.env.GEMINI_EMBEDDING_MODEL  (default: 'gemini-embedding-001')
//   process.env.GEMINI_GENERATION_MODEL (default: 'gemini-3.8-flash')
// Verify with: npx tsx scripts/verify-models.ts
```

These values are the starting point. The evaluation framework exists to measure and tune them.

---

## Why Not Send Entire Documents?

The entire purpose of RAG is to avoid sending entire documents to the LLM:
- Token cost: a 50-page PDF may contain 25,000+ tokens
- Context window dilution: irrelevant content degrades answer quality
- Gemini API free tier has token limits
- Semantic search surfaces the most relevant passages

The application enforces this by construction: the generation prompt only ever receives the top-k retrieved chunks.
