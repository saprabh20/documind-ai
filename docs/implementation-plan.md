# Implementation Plan — DocuMind AI

## Phase Overview

| Phase | Name | Description |
|---|---|---|
| 1 | Foundation | Types, DB schema, environment, config |
| 2 | Document Ingestion | Extraction, chunking, embedding, storage |
| 3 | RAG Q&A | Retrieval, generation, citation validation |
| 4 | Frontend UI | Upload, list, Q&A, citations |
| 5 | Evaluation Framework | Metrics, runner, dataset management |
| 6 | Security Hardening | Rate limiting, prompt injection, validation |
| 7 | Demo Preparation | Sample docs, feature flags, polish |

Do not begin a phase until the previous phase passes its acceptance criteria.

---

## Phase 1: Foundation

**Goal:** Working development environment with typed schema, DB client, and configuration.

### Tasks

1. Install dependencies:
   - `@google/genai`
   - `@supabase/supabase-js`
   - `pdfjs-dist`
   - `vitest`
   - `@vitejs/plugin-react`

2. Create `src/types/index.ts` with all shared types:
   - `Document`, `DocumentChunk`, `Citation`, `QuestionResponse`
   - `EvalQuestion`, `EvalRun`, `EvalResult`

3. Create `src/lib/rag/config.ts` with `RAG_CONFIG` constants.

4. Create `src/lib/db/client.ts` — server-only Supabase client using service role key.

5. Create `.env.local` template (document which variables are needed — do not commit actual values).

6. Create `docs/migrations/001_initial_schema.sql` with the full database schema.

7. Set up Vitest: create `vitest.config.ts`.

8. Apply the database migration in Supabase.

### Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm test` runs (no tests yet, but Vitest is configured)
- [ ] DB schema is applied in Supabase (pgvector enabled, all tables exist)
- [ ] Supabase client connects without error (verify in a test route)

---

## Phase 2: Document Ingestion

**Goal:** Upload a document and see it stored with embeddings in the database.

### Tasks

1. `src/lib/documents/extractor.ts` — text extraction for PDF, TXT, MD.
2. `src/lib/rag/chunker.ts` — sliding window chunker with page tracking.
3. `src/lib/gemini/client.ts` — GoogleGenAI singleton.
4. `src/lib/gemini/embeddings.ts` — embedContent with retry logic.
5. `src/lib/db/documents.ts` — `insertDocument`, `listDocuments`, `deleteDocument`, `getDocument`.
6. `src/lib/db/chunks.ts` — `insertChunks`, `getChunksByDocument`.
7. `src/lib/documents/processor.ts` — orchestrates extraction → chunking → embedding → storage.
8. `POST /api/documents` route — validates file, calls processor.
9. `GET /api/documents` route — returns document list.
10. `DELETE /api/documents/[id]` route — deletes document (feature-flagged).
11. Write Vitest unit tests for `chunker.ts`.

### Acceptance Criteria
- [ ] Upload a PDF → document and chunks appear in Supabase with non-null embeddings
- [ ] Upload a TXT → same
- [ ] Upload an MD → same
- [ ] Reject a file > 4 MB with HTTP 413
- [ ] Reject an invalid file type with HTTP 400
- [ ] Chunker unit tests pass
- [ ] Deleting a document removes it and its chunks (cascade)

---

## Phase 3: RAG Q&A

**Goal:** Ask a question about an uploaded document and receive a grounded answer with citations.

### Tasks

1. `src/lib/rag/retrieval.ts` — pgvector cosine similarity search.
2. `src/lib/gemini/generation.ts` — answer generation with grounding prompt.
3. `src/lib/rag/pipeline.ts` — full RAG orchestration + citation validation.
4. `POST /api/questions` route — validates question, calls pipeline, returns response.
5. Write unit tests for citation validation logic in `pipeline.ts`.

### Acceptance Criteria
- [ ] A question about an uploaded document returns a non-empty answer
- [ ] Every citation in the response corresponds to a retrieved chunk ID
- [ ] Citations include correct filename and page number (from DB, not LLM)
- [ ] A question with no relevant content returns "cannot answer confidently"
- [ ] LLM-invented chunk IDs are stripped from the response
- [ ] Citation validation unit tests pass

---

## Phase 4: Frontend UI

**Goal:** Polished, responsive UI covering all user-facing features.

### Tasks

1. Update `src/app/layout.tsx` — app title, metadata.
2. `src/app/page.tsx` — main layout: sidebar (documents) + main (Q&A).
3. `src/components/DocumentUpload.tsx` — drag-and-drop file upload with progress.
4. `src/components/DocumentList.tsx` — list of documents with metadata, delete button.
5. `src/components/QuestionForm.tsx` — question input with character counter, submit.
6. `src/components/AnswerDisplay.tsx` — rendered answer text with inline citation markers.
7. `src/components/CitationCard.tsx` — expandable source passage with filename/page.
8. Responsive layout (mobile + desktop).
9. Loading states for upload and question submission.
10. Error states (upload failed, question failed, no documents uploaded).

### Acceptance Criteria
- [ ] Upload UI works; document appears in list after successful upload
- [ ] Question UI works; answer and citations display correctly
- [ ] Citations expand to show source passage
- [ ] UI is usable on mobile (375 px) and desktop (1280 px)
- [ ] Upload and delete controls are hidden when feature flags are disabled
- [ ] All error states are handled gracefully (no unhandled promise rejections)

---

## Phase 5: Evaluation Framework

**Goal:** Run a real evaluation and display results in the UI.

### Tasks

1. `src/lib/evaluation/metrics.ts` — `computeHitAtK`, `computeRecallAtK`, `computeMRR`.
2. `src/lib/evaluation/runner.ts` — evaluation loop, stores results in DB.
3. `src/lib/db/evaluation.ts` — `insertEvalQuestion`, `listEvalQuestions`, `insertEvalRun`, `insertEvalResults`, `listEvalRuns`.
4. `GET /api/evaluation` and `POST /api/evaluation` routes.
5. `GET /api/evaluation/datasets` and `POST /api/evaluation/datasets` routes.
6. `src/components/EvaluationDashboard.tsx` — metrics display.
7. Author initial evaluation dataset (minimum 10 questions across 2+ documents).
8. Write unit tests for all metric calculations.

### Acceptance Criteria
- [ ] Metrics unit tests pass (test cases with known expected outputs)
- [ ] `POST /api/evaluation` runs successfully and stores results in DB
- [ ] UI displays real metrics from the last run
- [ ] At least 10 eval questions authored
- [ ] Hit@5 is calculated correctly against the authored dataset

---

## Phase 6: Security Hardening

**Goal:** All security requirements from `docs/security.md` are implemented.

### Tasks

1. File upload validation (MIME type + extension double-check).
2. Question length validation.
3. Rate limiter for upload and question endpoints.
4. Rate limiter for evaluation endpoint.
5. Prompt injection delimiters in generation prompt.
6. Server-side feature flag checks for upload and delete.
7. Review all SQL queries for parameterization.
8. Verify no secrets in client bundle (`npm run build` + inspect `.next`).

### Acceptance Criteria
- [ ] File with mismatched type/extension rejected
- [ ] Question > 1000 chars rejected with 400
- [ ] Upload and delete blocked when feature flags are false (server-side check)
- [ ] Prompt includes UNTRUSTED DOCUMENT CONTENT delimiters
- [ ] `GEMINI_API_KEY` does not appear in the production bundle

---

## Phase 7: Demo Preparation

**Goal:** Application is ready for public deployment on Vercel with sample documents.

### Tasks

1. Select 3–5 sample documents (publicly available, interesting, different file types).
2. Upload sample documents in local dev; record chunk IDs.
3. Author evaluation questions for sample documents.
4. Run evaluation; confirm metrics meet baseline expectations.
5. Set `ENABLE_UPLOAD=false`, `ENABLE_DELETE=false` in Vercel environment variables.
6. Deploy to Vercel.
7. Update `README.md` with project description, live URL, and setup instructions.
8. Final responsive UI polish.

### Acceptance Criteria
- [ ] Deployed URL is accessible
- [ ] Sample documents are queryable
- [ ] Upload and delete are blocked on the deployed version
- [ ] README includes live URL and setup instructions
- [ ] Evaluation dashboard shows real metrics

---

## Dependencies to Install (Phase 1)

```bash
npm install @google/genai @supabase/supabase-js pdfjs-dist
npm install --save-dev vitest @vitejs/plugin-react @vitest/ui
```

No other runtime dependencies are anticipated. If additional dependencies are needed in later phases, they must be discussed and approved first.
