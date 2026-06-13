# 🥃 Cellar

Master bottle database — the single source of truth for bottle identity across all
consuming apps (Drop Tracker, Beacon, Finish, and future apps).

Cellar owns **catalog identity only**: what a bottle *is*. Per-app data (drops, stock
alerts, pours, ownership) stays in each app, keyed by Cellar's immutable bottle `id`.

## Data model

```
Bottle (expression-level, e.g. "George T. Stagg" — immutable integer id)
 ├─ Alias[]        shortcodes (globally unique, lowercased) — the matching contract
 ├─ Release[]      optional vintage/batch children (e.g. 2024 vs 2025), only when needed
 └─ StoreListing[] {store, handle} → bottleId mapping (Beacon's dedupe layer)

PendingBottle      inbound review queue — the only write path for consuming apps
```

Key rules:

- **Bottle ids are immutable and never deleted** — only soft-archived (`isArchived`).
  Other apps store them as foreign keys.
- **Shortcodes are globally unique** — collisions are rejected at write time, and the
  bottle-level `warn` field carries human guidance (e.g. `OFitz1924` vs `OFo1924`).
- A bottle is an **expression**, not a vintage and not a physical bottle. Add `Release`
  children only when a specific release matters.

## API

Reads are open; the one write endpoint requires `Authorization: Bearer $CELLAR_API_TOKEN`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/bottles` | GET | Full canonical catalog (`?archived=1` to include archived) |
| `/api/drop-tracker` | GET | Drop Tracker compatibility shape: `{id, name, brand, tier, codes, warn, abcNo}` |
| `/api/listings` | GET | Beacon's map: `{store, handle, bottleId}` (`?store=` to filter) |
| `/api/match?q=EHT,GTS` | GET | Normalization-as-a-service: freeform tokens → `{matched, unmatched}` (exact alias, then unique-prefix) |
| `/api/pending` | GET | Current pending queue |
| `/api/pending` | POST | Submit an unmapped listing: `{store, handle, title, vendor?, url?, image?, price?}`. Idempotent on `(store, handle)`; returns `{status: "already-mapped", bottleId}` if a mapping exists. **Auth required.** |
| `/api/export` | GET | CSV export (round-trippable with `/import`) |

## Web UI

- `/bottles` — searchable catalog (name/brand/shortcode) with a filter for every
  displayed column; columns shown are configurable in the Control Panel
- `/control-panel` — toggle which bottle fields (distillery, category, NDP, MSRP, …)
  appear as columns/filters on the bottle list (saved to a cookie); also manage
  **brand rules** (brand → default distillery/category/NDP), applied as fill-the-blanks
  on import + new-bottle entry, with a button to backfill existing bottles
- `/bottles/new`, `/bottles/[id]/edit` — entry forms (main editing flow), releases, archive
- `/pending` — review queue: match to existing bottle / create new / ignore
- `/import` — CSV bulk import (paste or upload). Rows with `id` update in place; rows
  without create. For mass grid edits, export CSV → edit in Excel → re-import, or run
  `npm run db:studio` locally against the production `DATABASE_URL`.

CSV columns: `id,name,brand,distillery,category,tier,my_tier,vabc_code,ndp,msrp,warn,notes,shortcodes`
(`shortcodes` semicolon-separated; `ndp` truthy = `1/true/yes`; only `name` and `brand` required).

## Local development

```bash
npm install
cp .env.example .env        # set DATABASE_URL + CELLAR_API_TOKEN
npx prisma migrate deploy   # create tables
npm run db:seed             # optional starter bottles (skips if table non-empty)
npm run dev
```

## Deploying to Railway

1. New Railway project → add a **Postgres** service and a service from this repo.
2. On the app service set variables:
   - `DATABASE_URL` → reference the Postgres service's `DATABASE_URL`
   - `CELLAR_API_TOKEN` → `openssl rand -hex 24`
3. `railway.json` handles the rest (`prisma migrate deploy` runs pre-deploy).

## Migrating the consuming apps

1. **Seed the catalog**: export Drop Tracker's 69-bottle list to CSV (preserving its
   ids 1–69) and import at `/import`. Reconcile the spec-vs-code field drift here —
   the CSV format is the superset of both.
2. **Drop Tracker** (small): point its bottle fetch at `GET /api/drop-tracker` instead
   of the Apps Script `?action=getBottles` URL. The response fields match its
   `parseBottle()` exactly. The localStorage cache keeps working unchanged.
3. **Beacon** (small–moderate): each loop, fetch `GET /api/listings?store=<site>` to tag
   known products with `bottleId`; POST products with no mapping to `/api/pending`
   (replaces the dead `pending_bottles.json` stub). Resolve the queue at `/pending`.
4. **Finish** (moderate): add a `cellarBottleId` to its Bottle model; its catalog-identity
   fields (line/distillery naming) defer to Cellar over time, while ownership data
   (status, fill level, price paid, pours, photos) stays in Finish.
