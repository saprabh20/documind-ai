# Deployment — DocuMind AI

## Target platform

Vercel Hobby (free) + Supabase Free tier.

Next.js 16 App Router. Node.js runtime. No edge runtime — pdfjs-dist requires Node.js.

---

## One-time database setup

Run each migration in order in the Supabase SQL editor
(Dashboard → SQL Editor → New query):

| File | Purpose |
|------|---------|
| `docs/migrations/001_initial_schema.sql` | Core tables + HNSW index |
| `docs/migrations/002_retrieval_function.sql` | `match_chunks` pgvector function |
| `docs/migrations/003_rate_limits.sql` | Rate limiting table + `increment_rate_limit` function |

---

## Vercel environment variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables.
All variables apply to the **Production** environment unless noted.

| Variable | Required | Notes |
|----------|----------|-------|
| `GEMINI_API_KEY` | ✅ | From Google AI Studio. Server-only — never `NEXT_PUBLIC_`. |
| `GEMINI_EMBEDDING_MODEL` | ✅ | Default: `gemini-embedding-001` |
| `GEMINI_GENERATION_MODEL` | ✅ | Default: `gemini-3.5-flash-lite` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | From Supabase → Project Settings → API. Safe to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | From Supabase → Project Settings → API. Safe to expose. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | From Supabase → Project Settings → API. **Server-only.** Never prefix with `NEXT_PUBLIC_`. |
| `ENABLE_UPLOAD` | ✅ | Set to `false` for the public demo. Prevents document uploads server-side. |
| `ENABLE_DELETE` | ✅ | Set to `false` for the public demo. Prevents document deletions server-side. |
| `RATE_LIMIT_SECRET` | ✅ | Server-only HMAC secret for pseudonymising client IPs before storing in `rate_limits`. Never prefix with `NEXT_PUBLIC_`. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Demo data seeding

After deploying and running migrations, seed the demo documents:

```bash
# Locally, pointing at your production Supabase project:
NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
  npm run seed:demo
```

Or run it from `.env.local` if it already points at production:

```bash
npm run seed:demo
```

This ingests the three sample documents (`nova-software-employee-handbook.txt`,
`meridian-api-reference.txt`, `aurora-platform-guide.txt`) into the production
database. Idempotent — safe to run multiple times.

---

## Vercel configuration notes

- `pdfjs-dist` must be in `serverExternalPackages` in `next.config.ts` (already set).
  Without this, the PDF parser fails at runtime in Vercel's bundled environment.
- `cacheComponents: true` requires all async server components to be wrapped in
  `<Suspense>` (already done for the home stats and evaluation page).
- No edge runtime is used. All Route Handlers run on Node.js.

---

## Local development

```bash
cp .env.local.example .env.local
# Fill in your values, then:
npm install
npm run dev
```

---

## Verifying model access

Before the first deployment, confirm your API key can reach both models:

```bash
npx tsx scripts/verify-models.ts
```

A 503 during verification is typically Gemini high demand — not a config failure.
Wait 60 seconds and retry.
