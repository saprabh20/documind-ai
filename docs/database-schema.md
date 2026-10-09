# Database Schema — DocuMind AI

## PostgreSQL on Supabase with pgvector

All tables live in the `public` schema on Supabase PostgreSQL.

---

## Migration: 001_initial_schema.sql

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- documents
-- ============================================================
-- One row per uploaded file.
CREATE TABLE documents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename        TEXT        NOT NULL,
  file_type       TEXT        NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md')),
  file_size_bytes INTEGER     NOT NULL,
  page_count      INTEGER,                    -- NULL for txt/md
  chunk_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- document_chunks
-- ============================================================
-- One row per text chunk extracted from a document.
-- The embedding column stores the 768-dim vector from gemini-embedding-001.
CREATE TABLE document_chunks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER     NOT NULL,          -- 0-based position within document
  content       TEXT        NOT NULL,
  page_number   INTEGER,                       -- NULL for txt/md
  token_count   INTEGER     NOT NULL,
  embedding     vector(768),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B-tree index for fast lookup by document
CREATE INDEX document_chunks_document_id_idx
  ON document_chunks (document_id);

-- HNSW index for approximate nearest-neighbor vector search
-- m=16, ef_construction=64 are good defaults for datasets up to ~100k vectors
CREATE INDEX document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- eval_questions
-- ============================================================
-- Manually authored ground-truth questions for RAG evaluation.
-- expected_chunk_ids: array of chunk UUIDs that should be retrieved
-- to correctly answer this question.
CREATE TABLE eval_questions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID        REFERENCES documents(id) ON DELETE SET NULL,
  question            TEXT        NOT NULL,
  expected_chunk_ids  UUID[]      NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- eval_runs
-- ============================================================
-- One row per evaluation run. Stores configuration and aggregate metrics.
CREATE TABLE eval_runs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  top_k           INTEGER     NOT NULL,
  chunk_size      INTEGER     NOT NULL,
  chunk_overlap   INTEGER     NOT NULL,
  question_count  INTEGER     NOT NULL,
  hit_at_5        FLOAT,
  recall_at_5     FLOAT,
  mrr             FLOAT,
  avg_latency_ms  FLOAT,
  notes           TEXT
);

-- ============================================================
-- eval_results
-- ============================================================
-- One row per question per evaluation run. Stores per-question results.
CREATE TABLE eval_results (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID    NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  question_id           UUID    NOT NULL REFERENCES eval_questions(id) ON DELETE CASCADE,
  retrieved_chunk_ids   UUID[]  NOT NULL,
  latency_ms            INTEGER NOT NULL,
  reciprocal_rank       FLOAT   NOT NULL,   -- 1/rank of first relevant result, or 0
  hit                   BOOLEAN NOT NULL    -- true if any expected chunk in top-k
);
```

---

## Vector Similarity Search Query

Used by the retrieval module:

```sql
SELECT
  dc.id,
  dc.document_id,
  dc.chunk_index,
  dc.content,
  dc.page_number,
  dc.token_count,
  d.filename,
  d.file_type,
  1 - (dc.embedding <=> $1::vector) AS similarity
FROM document_chunks dc
JOIN documents d ON d.id = dc.document_id
WHERE dc.embedding IS NOT NULL
ORDER BY dc.embedding <=> $1::vector
LIMIT $2;
```

`$1` = query embedding as a float array cast to vector
`$2` = top-k (default 5)
`<=>` = cosine distance operator (lower = more similar)

---

## Schema Rationale

### Why HNSW over IVFFlat?
HNSW (Hierarchical Navigable Small World) provides better recall and does not require a training step (no need to `CLUSTER` or set `lists`). IVFFlat requires the table to be populated before building the index and degrades with small datasets. HNSW is the better default for a project that starts small.

### Why `vector(768)` exactly?
The `gemini-embedding-001` model outputs 768-dimensional vectors. The pgvector column dimension must match exactly — mismatches cause insertion errors.

### Why cascade delete for chunks?
When a document is deleted, its chunks have no independent utility. Cascading simplifies deletion and prevents orphaned embeddings consuming storage.

### Why `UUID[]` for expected_chunk_ids and retrieved_chunk_ids?
PostgreSQL native arrays are sufficient. This avoids a join table for a simple list of IDs. For evaluation, the arrays are small (≤k) and queried by application code, not SQL.

### Why `ON DELETE SET NULL` for eval_questions.document_id?
Evaluation questions represent intellectual effort (manually authored). If the source document is deleted, the question may still be useful for testing if the document is re-uploaded. Cascade delete would lose that work.

---

## Supabase Setup Notes

1. Run migrations via the Supabase SQL editor or `supabase db push`.
2. Enable the pgvector extension in Supabase Dashboard → Database → Extensions before running migrations.
3. The service role key (server-side only) bypasses Row Level Security — do not expose it to the browser.
4. If Row Level Security is enabled on any table, ensure server-side operations use the service role client.

---

## Index Sizing Notes

Supabase Free tier: 500 MB database.

Rough storage estimate per document:
- 100-page PDF → ~250 chunks (800 token chunks)
- Each chunk embedding: 768 × 4 bytes = 3 KB
- Each chunk row (content + metadata): ~2 KB
- Per document: ~250 × 5 KB = ~1.25 MB

500 MB supports approximately **400 documents** with the above assumptions — well within portfolio demo needs.
