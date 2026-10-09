# Smoke Test Checklist — DocuMind AI

Run these checks after every deployment and before sharing the demo link.

## Pre-flight

- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 errors, 0 warnings)
- [ ] `npm run test` passes (all tests green)
- [ ] `npm run build` succeeds (0 build errors)
- [ ] `docs/migrations/003_rate_limits.sql` has been run in Supabase SQL editor
- [ ] `npm run seed:demo` has been run against the production Supabase project
- [ ] Vercel environment variables are set (see docs/deployment.md)

---

## Page Load

- [ ] Home page loads without errors (`/`)
- [ ] Ask AI page loads without errors (`/ask`)
- [ ] Documents page loads without errors (verify via nav)
- [ ] Evaluation page loads without errors (`/evaluation`)
- [ ] No JavaScript console errors on any page

---

## Documents

- [ ] Document list shows the 3 seeded demo documents
- [ ] Upload button is NOT visible (ENABLE_UPLOAD=false in production)
- [ ] Delete button is NOT visible (ENABLE_DELETE=false in production)
- [ ] Attempting `POST /api/documents` directly returns `403`
- [ ] Attempting `DELETE /api/documents/<uuid>` directly returns `403`

---

## Ask AI

- [ ] Suggested question chips are visible
- [ ] Clicking a suggested question populates the textarea
- [ ] Submitting a question triggers "Searching…" then "Generating…" states
- [ ] Answer appears with citations
- [ ] Each citation links to a real document chunk (filename + page/section visible)
- [ ] Asking a question about a topic not in the documents returns a "cannot answer" response rather than a hallucinated answer
- [ ] Character counter updates while typing
- [ ] Submitting an empty question does nothing (button is disabled)

---

## Rate Limiting

- [ ] Sending 21+ rapid POST requests to `/api/questions` returns `429` on the 21st
  - Quick test: `for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<your-domain>/api/questions -H 'Content-Type: application/json' -d '{"question":"test"}'; done`
  - The first 20 should return 200/400/503; from ~21 onward should return 429

---

## Evaluation Page

- [ ] Evaluation page shows metrics from the stored baseline run
- [ ] Hit@1, Hit@3, Recall@1, Recall@3, latency values are displayed
- [ ] Per-question table shows HIT/MISS badges

---

## Security Headers

Verify with `curl -I https://<your-domain>`:

- [ ] `x-frame-options: DENY` is present
- [ ] `x-content-type-options: nosniff` is present
- [ ] `referrer-policy: strict-origin-when-cross-origin` is present
- [ ] `permissions-policy` is present
- [ ] No `server` header leaking technology stack (Vercel handles this)

---

## Dark Mode

- [ ] Toggle dark mode — all pages render correctly without colour clashes
- [ ] No white flash on dark mode load

---

## Mobile

- [ ] Home page is readable on a 375px viewport
- [ ] Navigation hamburger works (if applicable)
- [ ] Ask AI textarea and button are usable on mobile
