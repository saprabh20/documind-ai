-- DocuMind AI — Initial Database Schema
-- Run this in the Supabase SQL editor.
-- Requires: pgvector extension enabled (Supabase Dashboard → Database → Extensions)

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- documents
-- ============================================================
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
CREATE TABLE document_chunks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER     NOT NULL,
  content       TEXT        NOT NULL,
  page_number   INTEGER,                       -- NULL for txt/md
  token_count   INTEGER     NOT NULL,
  embedding     vector(768),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_chunks_document_id_idx
  ON document_chunks (document_id);

-- HNSW index for approximate nearest-neighbor cosine similarity search
CREATE INDEX document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============================================================
-- eval_questions
-- ============================================================
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
CREATE TABLE eval_results (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID    NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  question_id           UUID    NOT NULL REFERENCES eval_questions(id) ON DELETE CASCADE,
  retrieved_chunk_ids   UUID[]  NOT NULL,
  latency_ms            INTEGER NOT NULL,
  reciprocal_rank       FLOAT   NOT NULL,
  hit                   BOOLEAN NOT NULL
);
