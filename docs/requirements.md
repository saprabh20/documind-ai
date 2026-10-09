# Requirements — DocuMind AI

## Project Purpose

DocuMind AI is a full-stack Retrieval-Augmented Generation (RAG) document intelligence platform. Users upload documents and ask questions about their contents. Answers are grounded in retrieved document content and include verifiable source citations.

This is a portfolio project targeting Software Engineer, Full-Stack Engineer, and Applied AI Engineer roles. It is publicly available on GitHub.

## Functional Requirements

### Document Management
- FR-01: Upload PDF documents (max 4 MB)
- FR-02: Upload TXT documents (max 4 MB)
- FR-03: Upload Markdown documents (max 4 MB)
- FR-04: List all uploaded documents
- FR-05: Delete documents (local development only)
- FR-06: Display document metadata (filename, type, size, chunk count, upload date)

### Text Processing
- FR-07: Extract text from PDF files
- FR-08: Preserve page number information for PDF chunks
- FR-09: Extract text from TXT and Markdown files
- FR-10: Normalize extracted text (whitespace, encoding)
- FR-11: Split text into overlapping chunks (~800 tokens, ~100 token overlap)
- FR-12: Chunk size and overlap must be configurable constants

### Embeddings and Storage
- FR-13: Generate 768-dimensional embeddings using `gemini-embedding-001`
- FR-14: Store embeddings in PostgreSQL using pgvector
- FR-15: Embeddings for document chunks and queries must use identical configuration

### Question Answering
- FR-16: Accept a natural language question from the user
- FR-17: Generate a query embedding and perform vector similarity search
- FR-18: Retrieve top-5 most relevant chunks (k is configurable)
- FR-19: Generate an answer grounded exclusively in retrieved chunks
- FR-20: Return the answer with source citations

### Citations
- FR-21: Every citation must correspond to a chunk actually retrieved from the database
- FR-22: Citation metadata (filename, page number) must come from the database, not the LLM
- FR-23: Validate all LLM-generated citation references against retrieved chunk IDs
- FR-24: Strip invalid citations before returning the response
- FR-25: If retrieved evidence is insufficient, respond that the question cannot be answered confidently from the provided documents
- FR-26: Allow users to inspect the source passage for each citation

### Evaluation
- FR-27: Store manually verified evaluation questions with expected chunk IDs
- FR-28: Run evaluation against the stored dataset
- FR-29: Report Hit@5, Recall@5, Mean Reciprocal Rank, and average retrieval latency
- FR-30: Evaluation metrics displayed in the UI must come from real evaluation runs

### Demo / Deployment
- FR-31: Upload functionality can be disabled via environment variable (`ENABLE_UPLOAD`)
- FR-32: Delete functionality can be disabled via environment variable (`ENABLE_DELETE`)
- FR-33: Upload/delete guards must exist in route handlers, not only in the UI
- FR-34: Preloaded sample documents must be available on the public deployment

## Non-Functional Requirements

### Security
- NFR-01: API keys and database credentials must remain server-side
- NFR-02: Document content must never be treated as system instructions
- NFR-03: All SQL must use parameterized queries
- NFR-04: File type must be validated by MIME type and extension
- NFR-05: Question length must be limited (1000 characters)
- NFR-06: API routes must implement rate limiting

### Performance
- NFR-07: Vector search must use an HNSW index for sub-second retrieval
- NFR-08: Retrieval latency must be measured and reported

### Reliability
- NFR-09: Ingestion failures must not leave partial document state (use transactions)

### Maintainability
- NFR-10: All configuration constants (chunk size, overlap, top-k) in one location
- NFR-11: Strong TypeScript types throughout; no `any` without justification
- NFR-12: Modular architecture — each lib module has a single responsibility

### Cost
- NFR-13: All services must be usable within free tiers (Vercel Hobby, Supabase Free, Gemini API free tier)

## Constraints

- No OpenAI, LangChain, LangGraph, Ollama, Pinecone, or other paid AI/vector services
- No microservices or Kubernetes
- Vercel serverless function body limit: 4.5 MB (file upload limit set to 4 MB)
- Supabase Free: 500 MB database, 1 GB storage
- Gemini API free tier: rate limits apply (60 RPM for Flash, 5 RPM for embeddings)
