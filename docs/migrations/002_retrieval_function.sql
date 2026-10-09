-- Migration: 002_retrieval_function.sql
-- Must be run in the Supabase SQL editor before Phase 3 retrieval works.
--
-- Creates a PostgreSQL function for vector similarity search using pgvector.
-- Called from TypeScript via Supabase's .rpc('match_chunks', {...}).
--
-- Security notes:
--   - Function is schema-qualified as public.match_chunks.
--   - Table references are fully qualified (public.document_chunks, public.documents)
--     so the function does not depend on the session search_path.
--   - SECURITY INVOKER (default): runs with the permissions of the calling role.
--   - EXECUTE is revoked from PUBLIC, anon, and authenticated.
--   - EXECUTE is granted only to service_role.
--   - All retrieval is expected to be performed server-side using the
--     SUPABASE_SERVICE_ROLE_KEY, which authenticates as service_role.

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding     vector(768),
  match_count         integer,
  filter_document_ids uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  document_id   uuid,
  chunk_index   integer,
  content       text,
  page_number   integer,
  token_count   integer,
  filename      text,
  file_type     text,
  similarity    float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.page_number,
    dc.token_count,
    d.filename,
    d.file_type::text,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.embedding IS NOT NULL
    AND (filter_document_ids IS NULL OR dc.document_id = ANY(filter_document_ids))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Revoke default PUBLIC execute permission, then grant only to service_role.
-- The exact function signature must be used in REVOKE/GRANT so PostgreSQL
-- can identify the specific overload being targeted.
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector(768), integer, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector(768), integer, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.match_chunks(vector(768), integer, uuid[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.match_chunks(vector(768), integer, uuid[]) TO service_role;
