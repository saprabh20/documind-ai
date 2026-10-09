import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// Server-side Supabase client
// ============================================================
// Uses the SERVICE ROLE KEY which bypasses Row Level Security.
// This module MUST only be imported in server-side code
// (Route Handlers, Server Components, lib modules called from them).
//
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// ============================================================

function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials. ' +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local.',
    )
  }

  return createClient(url, key, {
    auth: {
      // This is a server-side service client — no user sessions.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// Module-level singleton. Reused across requests within the same
// serverless function instance (warm invocations).
let _db: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (!_db) {
    _db = createServerClient()
  }
  return _db
}
