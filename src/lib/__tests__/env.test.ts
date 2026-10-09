import { describe, it, expect } from 'vitest'
import { parseEnv } from '@/lib/env'

// The minimum valid environment that satisfies the schema.
const validBase = {
  GEMINI_API_KEY: 'test-gemini-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  RATE_LIMIT_SECRET: 'a'.repeat(32),
}

describe('serverEnvSchema', () => {
  describe('required fields', () => {
    it('throws when GEMINI_API_KEY is missing', () => {
      // Error message includes the field path even if Zod's type message differs
      expect(() => parseEnv({ ...validBase, GEMINI_API_KEY: undefined })).toThrow(
        'GEMINI_API_KEY',
      )
    })

    it('throws when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      expect(() => parseEnv({ ...validBase, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow()
    })

    it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      expect(() => parseEnv({ ...validBase, SUPABASE_SERVICE_ROLE_KEY: undefined })).toThrow(
        'SUPABASE_SERVICE_ROLE_KEY',
      )
    })

    it('throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      expect(() =>
        parseEnv({ ...validBase, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined }),
      ).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    })

    it('throws when NEXT_PUBLIC_SUPABASE_URL is not a valid URL', () => {
      expect(() =>
        parseEnv({ ...validBase, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' }),
      ).toThrow()
    })
  })

  describe('default values', () => {
    it('defaults GEMINI_EMBEDDING_MODEL to gemini-embedding-001', () => {
      const result = parseEnv(validBase)
      expect(result.GEMINI_EMBEDDING_MODEL).toBe('gemini-embedding-001')
    })

    it('defaults GEMINI_GENERATION_MODEL to gemini-3.5-flash-lite', () => {
      const result = parseEnv(validBase)
      expect(result.GEMINI_GENERATION_MODEL).toBe('gemini-3.5-flash-lite')
    })

    it('defaults ENABLE_UPLOAD to true', () => {
      const result = parseEnv(validBase)
      expect(result.ENABLE_UPLOAD).toBe('true')
    })

    it('defaults ENABLE_DELETE to true', () => {
      const result = parseEnv(validBase)
      expect(result.ENABLE_DELETE).toBe('true')
    })
  })

  describe('optional overrides', () => {
    it('accepts custom GEMINI_EMBEDDING_MODEL', () => {
      const result = parseEnv({ ...validBase, GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001' })
      expect(result.GEMINI_EMBEDDING_MODEL).toBe('gemini-embedding-001')
    })

    it('accepts ENABLE_UPLOAD=false', () => {
      const result = parseEnv({ ...validBase, ENABLE_UPLOAD: 'false' })
      expect(result.ENABLE_UPLOAD).toBe('false')
    })

    it('accepts ENABLE_DELETE=false', () => {
      const result = parseEnv({ ...validBase, ENABLE_DELETE: 'false' })
      expect(result.ENABLE_DELETE).toBe('false')
    })

    it('rejects invalid ENABLE_UPLOAD value', () => {
      expect(() => parseEnv({ ...validBase, ENABLE_UPLOAD: 'yes' })).toThrow()
    })
  })

  describe('parseEnv', () => {
    it('returns a valid ServerEnv on a complete valid input', () => {
      const result = parseEnv({
        ...validBase,
        GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
        GEMINI_GENERATION_MODEL: 'gemini-3.5-flash-lite',
        ENABLE_UPLOAD: 'true',
        ENABLE_DELETE: 'false',
      })
      expect(result.GEMINI_API_KEY).toBe('test-gemini-key')
      expect(result.ENABLE_DELETE).toBe('false')
    })

    it('includes all missing fields in a single error message', () => {
      let errorMessage = ''
      try {
        parseEnv({})
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : ''
      }
      // All required fields should be mentioned
      expect(errorMessage).toContain('GEMINI_API_KEY')
      expect(errorMessage).toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(errorMessage).toContain('RATE_LIMIT_SECRET')
    })
  })
})

describe('RATE_LIMIT_SECRET validation', () => {
  it('throws when RATE_LIMIT_SECRET is missing', () => {
    expect(() =>
      parseEnv({ ...validBase, RATE_LIMIT_SECRET: undefined }),
    ).toThrow('RATE_LIMIT_SECRET')
  })

  it('throws when RATE_LIMIT_SECRET is shorter than 32 characters', () => {
    expect(() =>
      parseEnv({ ...validBase, RATE_LIMIT_SECRET: 'short' }),
    ).toThrow()
  })

  it('accepts a 32-character RATE_LIMIT_SECRET', () => {
    const result = parseEnv({ ...validBase, RATE_LIMIT_SECRET: 'a'.repeat(32) })
    expect(result.RATE_LIMIT_SECRET).toBe('a'.repeat(32))
  })

  it('accepts a long hex secret', () => {
    const secret = 'deadbeef'.repeat(8) // 64 chars
    const result = parseEnv({ ...validBase, RATE_LIMIT_SECRET: secret })
    expect(result.RATE_LIMIT_SECRET).toBe(secret)
  })
})
