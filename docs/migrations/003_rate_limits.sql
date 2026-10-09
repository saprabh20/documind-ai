-- DocuMind AI — Rate Limits Table + Helper Function
-- Run this in the Supabase SQL editor BEFORE deploying to production.
-- Required by the Supabase-based persistent rate limiter (src/lib/db/rate-limit.ts).
--
-- SECURITY PROPERTIES
-- -------------------
-- • RLS is enabled. No policy allows anon or authenticated direct access.
--   Only the service_role client (server-side only) can access rows.
-- • Table privileges for anon and authenticated are explicitly revoked.
-- • EXECUTE on increment_rate_limit is revoked from PUBLIC, anon, and
--   authenticated, then granted only to service_role.
-- • The function is SECURITY INVOKER (the default — no privilege escalation).
-- • All object references are fully schema-qualified (public.*).
-- • search_path is pinned to 'public' in the function declaration.
-- • The client_key column stores an HMAC-SHA-256 digest of the client IP,
--   never a raw IP address. The HMAC secret is server-only (RATE_LIMIT_SECRET).
--
-- DESTRUCTIVE IMPACT ON EXISTING DATA
-- ------------------------------------
-- None. This migration only creates new objects. It does not touch documents,
-- document_chunks, eval_questions, eval_runs, eval_results, or any existing
-- table. CREATE TABLE IF NOT EXISTS is safe to re-run.

-- ============================================================
-- Table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  client_key     TEXT        NOT NULL CHECK (client_key  <> ''),
  endpoint       TEXT        NOT NULL CHECK (endpoint    <> ''),
  window_start   TIMESTAMPTZ NOT NULL,
  request_count  INTEGER     NOT NULL DEFAULT 1 CHECK (request_count >= 1),
  PRIMARY KEY (client_key, endpoint, window_start)
);

-- RLS on. No policies → no role can access rows via the Supabase REST API.
-- The service_role client bypasses RLS (Supabase default), which is how the
-- application accesses this table.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke all table-level privileges from Supabase public-facing
-- roles. These statements are idempotent if the privileges were never granted.
REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.rate_limits FROM authenticated;

-- ============================================================
-- Function: atomic upsert + increment
-- ============================================================
-- Returns the new request_count after the increment.
-- The INSERT ... ON CONFLICT DO UPDATE is a single atomic statement —
-- concurrent calls from the same client_key and window serialize correctly.

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_client_key   TEXT,
  p_endpoint     TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public            -- pin search_path; no runtime resolution
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (client_key, endpoint, window_start, request_count)
  VALUES (p_client_key, p_endpoint, p_window_start, 1)
  ON CONFLICT (client_key, endpoint, window_start)
  DO UPDATE SET request_count = public.rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count;
END;
$$;

-- Revoke the implicit PUBLIC execute grant that PostgreSQL adds by default,
-- then explicitly grant only to service_role.
-- Exact function signature is required for REVOKE / GRANT on overloaded names.
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) TO   service_role;

-- ============================================================
-- Cleanup strategy (no external service required)
-- ============================================================
--
-- The table stays small for a low-traffic portfolio demo without cleanup.
-- Do NOT run the cron statement automatically — enable pg_cron first in
-- Supabase Dashboard → Database → Extensions if you want automated cleanup.
--
-- Option A — pg_cron (recommended, available on Supabase Free):
--
--   SELECT cron.schedule(
--     'cleanup-rate-limits',
--     '*/10 * * * *',
--     $$ DELETE FROM public.rate_limits
--        WHERE window_start < NOW() - INTERVAL '1 hour' $$
--   );
--
-- Option B — manual (run in Supabase SQL editor periodically):
--
--   DELETE FROM public.rate_limits
--   WHERE window_start < NOW() - INTERVAL '1 hour';
