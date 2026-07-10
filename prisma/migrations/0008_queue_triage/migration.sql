-- Mobile Quick-Add queue triage. Bookmarklet/paste captures land in
-- PendingBottle (store = 'quickadd') and are triaged yes/no/maybe from /queue.

-- "Decide later" bucket for the maybe action.
ALTER TYPE "PendingStatus" ADD VALUE 'MAYBE';

-- Parsed catalog fields carried from /add so accepting a queued item mints a
-- fully-populated bottle. Null on plain Beacon listings. (Brand rides in the
-- existing "vendor" column.)
ALTER TABLE "PendingBottle"
    ADD COLUMN "category" TEXT,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "shortcodes" TEXT;
