# Evaluation Framework — DocuMind AI

## Purpose

The evaluation framework measures retrieval quality objectively. It exists to:
1. Verify the RAG pipeline actually retrieves relevant content
2. Provide a basis for tuning chunk size, overlap, and top-k
3. Demonstrate applied ML evaluation methodology in the portfolio

**All metrics displayed in the UI must come from real evaluation runs stored in the database.**
No fabricated or hardcoded metrics.

---

## Evaluation Dataset

Module: `src/lib/evaluation/`
Database tables: `eval_questions`, `eval_results`, `eval_runs`

The dataset consists of manually authored questions with ground-truth chunk IDs:

```typescript
type EvalQuestion = {
  id: string;
  documentId: string | null;
  question: string;
  expectedChunkIds: string[];  // UUIDs of chunks that should be retrieved
};
```

`expectedChunkIds` is populated manually by the developer:
1. Upload a document and note the chunk IDs of key passages.
2. Write a question whose answer lies in those passages.
3. Record the chunk IDs as the expected retrieval set.

The dataset is stored in the database (not as a flat file) so that:
- It survives across deployments
- It can be expanded via the UI
- Chunk IDs remain stable references

---

## Metrics

Module: `src/lib/evaluation/metrics.ts`

### Hit@5

Measures whether at least one expected chunk appears in the top-5 retrieved results.

```
Hit@5 = (number of questions where ≥1 expected chunk is in top-5) / (total questions)
```

Binary per question (0 or 1). Aggregate is a proportion in [0, 1].

### Recall@5

Measures what fraction of expected chunks were retrieved in the top-5.

```
Recall@5 = mean over all questions of:
  |retrieved_chunk_ids ∩ expected_chunk_ids| / |expected_chunk_ids|
```

This rewards retrieving *all* relevant chunks, not just one.

### Mean Reciprocal Rank (MRR)

Measures how high the first relevant chunk appears in the ranking.

```
MRR = mean over all questions of:
  1 / (rank of first relevant chunk in retrieved list)

If no relevant chunk retrieved: 0
```

Example: if the first relevant chunk is at rank 3, reciprocal rank = 1/3.

### Average Retrieval Latency

Average wall-clock time from embedding the query to receiving the SQL results.

```
avg_latency_ms = mean(latency_ms) over all questions in the run
```

Measured in milliseconds. Does not include answer generation time (which is network-bound on the Gemini API).

---

## Evaluation Runner

Module: `src/lib/evaluation/runner.ts`

Algorithm:

```
For each eval_question in the dataset:
  1. Record start time
  2. Generate query embedding for question.question
  3. Run pgvector similarity search → retrieved_chunk_ids
  4. Record end time → latency_ms
  5. Compute reciprocal_rank
  6. Compute hit (boolean)
  7. Store eval_result row

After all questions:
  1. Aggregate: hit_at_5, recall_at_5, mrr, avg_latency_ms
  2. Insert eval_run row with aggregates
  3. Return run summary
```

The runner uses the same retrieval code as the Q&A pipeline (`src/lib/rag/retrieval.ts`) to ensure evaluation reflects real conditions.

---

## API Routes

### `POST /api/evaluation`
Triggers an evaluation run against all questions in `eval_questions`.

Request body:
```json
{
  "notes": "optional description of this run"
}
```

Uses current `RAG_CONFIG` values (top-k, chunk-size are recorded in the run row).

### `GET /api/evaluation`
Returns all evaluation runs ordered by `run_at DESC`.

### `GET /api/evaluation/datasets`
Returns all evaluation questions.

### `POST /api/evaluation/datasets`
Adds a new evaluation question.

```json
{
  "documentId": "<uuid>",
  "question": "What are the main conclusions of chapter 3?",
  "expectedChunkIds": ["<uuid1>", "<uuid2>"]
}
```

---

## UI Display

The `EvaluationDashboard` component displays:
- Latest run summary (Hit@5, Recall@5, MRR, avg latency)
- Run history table (all runs, configuration, metrics)
- "Run Evaluation" button (calls `POST /api/evaluation`)

Metrics are fetched from `GET /api/evaluation`. No hardcoded values.

---

## Baseline Expectations

With default configuration (800-token chunks, 100-token overlap, top-5):
- Hit@5 ≥ 0.80 is a reasonable target for well-formed questions about uploaded documents
- MRR ≥ 0.60 is achievable with semantic similarity search
- Average latency < 500 ms for retrieval alone (not including generation)

These are targets, not guarantees. Actual numbers depend on document quality and question difficulty.

---

## Evaluation Dataset Authoring Guidelines

1. Write questions that have specific factual answers in the document.
2. Avoid questions whose answers span the entire document.
3. Aim for 20–50 questions across 3–5 documents for a meaningful evaluation.
4. Include some hard questions (answers require combining two adjacent chunks).
5. Record the exact chunk IDs — do not guess. Query `document_chunks` for the document, read the content, and identify the relevant chunk IDs.
