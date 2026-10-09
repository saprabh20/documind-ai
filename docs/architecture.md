# Architecture — DocuMind AI

## Overview

DocuMind AI is a monolithic Next.js application. The frontend and backend live in the same repository and deploy to Vercel. All AI and database operations happen server-side via Next.js Route Handlers. No separate backend service exists.

```
Browser
  │
  ▼
Next.js (Vercel)
  ├── React UI (client components)
  └── Route Handlers (server-side)
        ├── /api/documents     → ingestion pipeline
        ├── /api/questions     → RAG Q&A pipeline
        └── /api/evaluation    → evaluation runner
              │
              ├── Supabase PostgreSQL + pgvector
              └── Google Gemini API
```

## Folder Structure

```
documind-ai/
├── docs/                          ← planning documents
│   └── migrations/
│       └── 001_initial_schema.sql
├── CLAUDE.md                      ← persistent Claude Code instructions
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── documents/
│   │   │   │   ├── route.ts       ← GET (list), POST (upload)
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts   ← GET (single doc), DELETE
│   │   │   ├── questions/
│   │   │   │   └── route.ts       ← POST (ask question)
│   │   │   └── evaluation/
│   │   │       ├── route.ts       ← GET (list runs), POST (run eval)
│   │   │       └── datasets/
│   │   │           └── route.ts   ← GET/POST eval questions
│   │   ├── page.tsx               ← main UI page
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── DocumentList.tsx       ← lists uploaded docs
│   │   ├── DocumentUpload.tsx     ← file upload form
│   │   ├── QuestionForm.tsx       ← question input
│   │   ├── AnswerDisplay.tsx      ← renders answer + citations
│   │   ├── CitationCard.tsx       ← expandable source passage
│   │   └── EvaluationDashboard.tsx← metrics display
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts          ← Supabase server-side client (singleton)
│   │   │   ├── documents.ts       ← document CRUD
│   │   │   ├── chunks.ts          ← chunk queries + vector search
│   │   │   └── evaluation.ts      ← eval question/run/result queries
│   │   ├── gemini/
│   │   │   ├── client.ts          ← GoogleGenAI singleton
│   │   │   ├── embeddings.ts      ← embedContent wrapper
│   │   │   └── generation.ts      ← generateContent for answers
│   │   ├── rag/
│   │   │   ├── config.ts          ← CHUNK_SIZE, CHUNK_OVERLAP, TOP_K
│   │   │   ├── chunker.ts         ← token-aware text splitter
│   │   │   ├── retrieval.ts       ← vector similarity search
│   │   │   └── pipeline.ts        ← end-to-end RAG orchestration
│   │   ├── documents/
│   │   │   ├── extractor.ts       ← PDF/TXT/MD text extraction
│   │   │   └── processor.ts       ← ingestion orchestration
│   │   └── evaluation/
│   │       ├── metrics.ts         ← Hit@5, Recall@5, MRR, latency
│   │       └── runner.ts          ← run eval against dataset
│   └── types/
│       └── index.ts               ← all shared TypeScript types
├── package.json
├── tsconfig.json
├── next.config.ts
└── vitest.config.ts
```

## Data Flow

### Ingestion Pipeline

```
POST /api/documents
  │
  ├─ Validate: file type (pdf/txt/md), file size (≤4 MB)
  ├─ Extract text:
  │   ├── PDF  → pdfjs-dist  → [{pageNumber, text}]
  │   ├── TXT  → Buffer.toString('utf-8')
  │   └── MD   → Buffer.toString('utf-8')
  ├─ Normalize text (collapse whitespace, strip null bytes)
  ├─ Chunk text → [{content, pageNumber, tokenCount}]
  ├─ Insert document row (filename, type, size, pageCount)
  ├─ For each chunk:
  │   ├── Generate embedding via gemini-embedding-001
  │   └── Insert chunk row (documentId, index, content, page, tokens, embedding)
  └─ Update document.chunkCount
```

### Q&A Pipeline

```
POST /api/questions
  │
  ├─ Validate: question ≤1000 chars
  ├─ Generate query embedding via gemini-embedding-001
  ├─ pgvector cosine similarity search → top-k chunks
  ├─ Build context from retrieved chunks (with source metadata)
  ├─ Call gemini-3.5-flash-lite with structured prompt:
  │   ├── System: grounding rules + untrusted-content wrapper
  │   └── User: question + retrieved passages with chunk IDs
  ├─ Parse LLM response for answer text + cited chunk IDs
  ├─ Validate cited IDs against retrieved chunk IDs
  ├─ Hydrate valid citations from DB metadata (filename, page)
  └─ Return: {answer, citations: [{chunkId, filename, page, passage}]}
```

## Key Design Decisions

### Why a single Next.js monolith?
Simplicity. Vercel Hobby supports this deployment model at zero cost. A separate Express or FastAPI backend would add operational complexity for no benefit at this scale.

### Why Supabase + pgvector instead of a dedicated vector DB?
pgvector on PostgreSQL handles semantic search well for thousands of documents. It is free on Supabase and avoids introducing a second database service. Pinecone and similar services have free-tier limitations and add paid risk.

### Why `@google/genai` instead of `@google/generative-ai`?
The older `@google/generative-ai` package was deprecated in December 2025. `@google/genai` is the current official SDK (v2.28.0+).

### Why pdfjs-dist for PDF parsing?
It is the official Mozilla PDF.js library, actively maintained, works in Node.js, and enables page-level text extraction. This is the only way to accurately preserve page numbers for PDF citations.

### Why no LangChain?
LangChain adds abstractions that obscure what the RAG pipeline is actually doing. A portfolio project demonstrating applied AI understanding is more compelling with straightforward TypeScript modules.

### Why custom chunker instead of a library?
A simple sliding-window chunker with approximate token counting requires ~50 lines of TypeScript. No library dependency is justified for this.

### Citation validation architecture
The LLM is given chunk IDs in the prompt and asked to cite them. After generation, the application validates every cited ID against the set of retrieved chunk IDs. Source metadata is never entrusted to the LLM — it is looked up from the database after validation.

## Dependencies

| Package | Installed Version | Purpose |
|---|---|---|
| `next` | 16.4.0 | Framework |
| `react` | 19.3.0 | UI |
| `typescript` | ^5 | Type safety |
| `tailwindcss` | ^4 | Styling |
| `@google/genai` | ^2.28.0 | Gemini embeddings + generation |
| `@supabase/supabase-js` | ^2.117.3 | Database client |
| `pdfjs-dist` | ^6.4.299 | PDF text extraction with page numbers |
| `zod` | ^4.6.5 | Env + API request body validation |
| `vitest` | ^5.0.3 | Unit testing |
| `@vitejs/plugin-react` | ^6.1.2 | Vitest React component testing |
| `@vitest/ui` | ^5.0.3 | Vitest browser UI (dev only) |

No other runtime dependencies are planned. Any additions require explicit approval.

## Rate Limiting Strategy

In-memory rate limiting is insufficient for serverless (state is lost between cold starts).

**Solution:** Supabase PostgreSQL for persistent rate limiting. A `rate_limits` table stores request counts by IP per time window. The Q&A endpoint performs an upsert + count check on each request. Zero additional infrastructure required.

Uploads and deletes are disabled entirely in production via `ENABLE_UPLOAD=false` / `ENABLE_DELETE=false`, so per-IP limiting is only needed for the Q&A endpoint.

## Environment Variables

```
# Server-only (never NEXT_PUBLIC_)
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001     # configurable — verify with scripts/verify-models.ts
GEMINI_GENERATION_MODEL=gemini-3.5-flash-lite  # configurable — verify with scripts/verify-models.ts
SUPABASE_SERVICE_ROLE_KEY=

# Browser-safe
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Feature flags
ENABLE_UPLOAD=true
ENABLE_DELETE=true
```
