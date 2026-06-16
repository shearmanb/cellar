# Cellar — master bottle database

Next.js 16 (App Router) + Prisma 6 + Postgres. Deployed on Railway.

- Cellar is the single source of truth for bottle *identity* across Drop Tracker,
  Beacon, and Finish. Per-app data lives in those apps, keyed by Cellar's bottle id.
- Bottle ids are immutable integers; never delete bottles, only soft-archive.
- Shortcodes (Alias.code) are stored lowercased/whitespace-stripped and globally
  unique — they are the matching contract for all consuming apps.
- API contract and migration plan: see README.md. Don't change response shapes of
  `/api/bottles`, `/api/drop-tracker`, or `/api/listings` without versioning —
  external apps depend on them.
- Server actions in `lib/actions/`; route handlers in `app/api/`; all DB-touching
  routes/pages use `force-dynamic` (no DB at build time).
- Writes from apps go only through POST `/api/pending` (Bearer `CELLAR_API_TOKEN`).
- `/api/pending` answers CORS preflight (`OPTIONS`) and sends CORS headers so browser
  clients (e.g. the Beacon dashboard's "→ cellar" push) can call it cross-origin.
  Restrict origins with `CELLAR_CORS_ORIGIN` (comma-separated allowlist; the matching
  request origin is echoed back, else the first entry). Defaults to `*`, which is safe
  here because auth is a Bearer token, not a cookie.
