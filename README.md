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
| `/api/drop-tracker` | GET | Drop Tracker hunt list: `{id, name, displayValue, brand, tier, codes, warn, abcNo}` — only bottles whose `displayValue` is set |
| `/api/listings` | GET | Beacon's map: `{store, handle, bottleId}` (`?store=` to filter) |
| `/api/match?q=EHT,GTS` | GET | Normalization-as-a-service: freeform tokens → `{matched, unmatched}` (exact alias, then unique-prefix) |
| `/api/pending` | GET | Current pending queue |
| `/api/pending` | POST | Submit an unmapped listing: `{store, handle, title, vendor?, url?, image?, price?}`. Idempotent on `(store, handle)`; returns `{status: "already-mapped", bottleId}` if a mapping exists. **Auth required.** |
| `/api/export` | GET | CSV export (round-trippable with `/import`) |
| `/api/sync` | POST | Pull all `SYNC_STORES` Shopify stores and queue unknown products as pending. **Auth required.** For external cron. |

## Web UI

- `/bottles` — searchable catalog (name/brand/shortcode) with a filter for every
  displayed column; columns shown are configurable in the Control Panel.
  Toggle to **All fields** for the full read-only view.
- `/bottles/all` — read-only grid showing *every* stored field for every bottle
  (same search/tier/archived filters, horizontally scrollable)
- `/control-panel` — toggle which bottle fields (distillery, category, NDP, MSRP, …)
  appear as columns/filters on the bottle list (saved to a cookie); also manage
  **brand rules** (brand → default distillery/category/NDP), applied as fill-the-blanks
  on import + new-bottle entry, with a button to backfill existing bottles
- `/bottles/new`, `/bottles/[id]/edit` — entry forms (main editing flow), releases, archive
- `/add` — **Quick add**: paste a store title, listing, tasting notes, or JSON (or arrive from
  the bookmarklet) and Cellar parses it into name/brand/category/price/notes, flags likely
  existing matches, and creates the catalog bottle (same brand-rule + shortcode-collision rules
  as `/bottles/new`). Tier, VA ABC, and releases are filled in afterward on the edit page.
  Set `CELLAR_ADD_SECRET` to gate adding behind a shared secret: the page still loads (so the
  bookmarklet can prefill it), but creating a bottle requires unlocking once per browser, and
  the check is enforced server-side. Leave the var unset to keep Quick add open.
- `/bookmarklet` — installs a one-click browser bookmarklet that scrapes the page you're on
  (title, current text selection, Open Graph tags, JSON-LD product data) and opens `/add` with
  the fields prefilled. It only reads the page and passes data in the URL hash (no cross-origin
  fetch), so it works on most sites; the `/add` paste box is the fallback when a site's CSP
  blocks bookmarklets.
- `/pending` — review queue: match to existing bottle / create new / ignore. Includes a
  "Check stores now" button when `SYNC_STORES` is set (e.g.
  `SYNC_STORES=thereveries=https://store-url`) — Cellar polls each store's public
  Shopify `/products.json` and queues anything unmapped.
- `/dupes` — suspected duplicates (same brand + near-identical name, ignoring pairs
  that differ by age/proof/batch numbers). "Keep this one" merges the other bottle's
  shortcodes/mappings/releases into it and archives it; "Not a dupe" hides the pair.
- `/import` — CSV bulk import (paste or upload). Rows with `id` update in place; rows
  without create. For mass grid edits, export CSV → edit in Excel → re-import, or run
  `npm run db:studio` locally against the production `DATABASE_URL`.

CSV columns: `id,name,brand,distillery,category,tier,my_tier,vabc_code,ndp,vabc_allocated,added_to_vabc,first_appearance,msrp,warn,notes,shortcodes,display_value`
(`shortcodes` semicolon-separated; `ndp` truthy = `1/true/yes`; `vabc_allocated` is `true`/`false`;
`added_to_vabc` and `first_appearance` are dates as `YYYY-MM-DD`; only `name` and `brand` required.
`display_value` is the Drop Tracker label and include switch — set it to add a bottle to Drop
Tracker, clear it to remove. Omit the column entirely to leave existing display values untouched.)

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
   - `CELLAR_ADD_SECRET` (optional) → a shared secret that gates the `/add` Quick-Add write
3. `railway.json` handles the rest (`prisma migrate deploy` runs pre-deploy).

## Migrating the consuming apps

1. **Seed the catalog**: export Drop Tracker's 69-bottle list to CSV (preserving its
   ids 1–69) and import at `/import`. Reconcile the spec-vs-code field drift here —
   the CSV format is the superset of both.
2. **Drop Tracker** (small): point its bottle fetch at `GET /api/drop-tracker` instead
   of the Apps Script `?action=getBottles` URL. A bottle joins Drop Tracker's picker
   when you give it a `display_value` (the label the app shows); shortcodes are now
   optional. The localStorage cache keeps working unchanged.
3. **Beacon** (small–moderate): each loop, fetch `GET /api/listings?store=<site>` to tag
   known products with `bottleId`; POST products with no mapping to `/api/pending`
   (replaces the dead `pending_bottles.json` stub). Resolve the queue at `/pending`.
4. **Finish** (moderate): add a `cellarBottleId` to its Bottle model; its catalog-identity
   fields (line/distillery naming) defer to Cellar over time, while ownership data
   (status, fill level, price paid, pours, photos) stays in Finish.
