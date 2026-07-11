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
- The operator "Quick add" page (`/add`, fed by the bookmarklet) parses a paste into a bottle and
  **enqueues** it as a `PendingBottle` with `store = "quickadd"` (`lib/queue.ts`) rather than
  writing the catalog directly. Triage is the mobile `/queue` (yes/no/maybe): accept mints the
  bottle (brand rules + shortcode-collision checks), maybe → `PendingStatus.MAYBE`, no → ignore.
  Quick-add rows never create a `StoreListing` (that's Beacon's dedupe layer). `CELLAR_ADD_SECRET`
  gates the quick-add writes (enqueue + accept/match) via an unlock cookie enforced server-side;
  no-op when unset.
- Parser regression suite: `npm test` runs `tests/parse.test.ts` against `lib/parse.ts`.
  Whenever a real paste parses badly, add the verbatim paste as a test case with the expected
  fields FIRST, then fix the parser until green. Never weaken an existing case to make a new
  one pass.
- `/api/pending` answers CORS preflight (`OPTIONS`) and sends CORS headers so browser
  clients (e.g. the Beacon dashboard's "→ cellar" push) can call it cross-origin.
  Restrict origins with `CELLAR_CORS_ORIGIN` (comma-separated allowlist; the matching
  request origin is echoed back, else the first entry). Defaults to `*`, which is safe
  here because auth is a Bearer token, not a cookie.
