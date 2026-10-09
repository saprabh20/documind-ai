import { z } from 'zod'

// ============================================================
// Environment variable schema
// ============================================================
// This module validates all required environment variables at
// call time. Import `parseEnv` and call it in server-side code
// (route handlers, lib modules) to get a typed, validated env.
//
// IMPORTANT: This file must only be imported in server-side code.
// It reads SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY, which
// must never be exposed to the browser.
// ============================================================

export const serverEnvSchema = z.object({
  // Gemini API
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Model identifiers — configurable so they can be updated without code changes.
  // Run scripts/verify-models.ts to confirm your API key can access these models.
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  GEMINI_GENERATION_MODEL: z.string().default('gemini-3.8-flash'),

  // Supabase — server-only credentials
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://xxx.supabase.co)'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // Feature flags — set to 'false' in the public deployment
  ENABLE_UPLOAD: z.enum(['true', 'false']).default('true'),
  ENABLE_DELETE: z.enum(['true', 'false']).default('true'),

  // Rate limiting — server-only HMAC secret for pseudonymising client IPs.
  // Must never use the NEXT_PUBLIC_ prefix. Must never be committed.
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  RATE_LIMIT_SECRET: z
    .string()
    .min(32, 'RATE_LIMIT_SECRET must be at least 32 characters'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Validates and returns typed environment variables.
 *
 * Accepts an optional `env` argument for testing (defaults to `process.env`).
 * Throws with a descriptive message listing all missing/invalid variables.
 */
export function parseEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = serverEnvSchema.safeParse(env)
  if (!result.success) {
    const errors = result.error.issues
      .map(issue => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Missing or invalid environment variables:\n${errors}`)
  }
  return result.data
}

// Note: env is validated lazily (by callers invoking parseEnv()) rather than
// eagerly at module load. This keeps the module testable without real env vars.
// Production route handlers call parseEnv() once at the top of each handler.
