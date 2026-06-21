-- Drop Tracker display label. Doubles as the "is this bottle in Drop Tracker"
-- switch: the /api/drop-tracker feed (and the app's picker) include a bottle
-- only when displayValue is set.
ALTER TABLE "Bottle" ADD COLUMN "displayValue" TEXT;

-- Bootstrap the existing curated hunt list: seed displayValue (= name) for
-- bottles that already carry a tier or at least one shortcode. The retail /
-- Beacon catalog bottles have neither and stay out of Drop Tracker until a
-- displayValue is set for them.
UPDATE "Bottle"
SET "displayValue" = "name"
WHERE ("tier" IS NOT NULL AND "tier" <> '')
   OR EXISTS (SELECT 1 FROM "Alias" WHERE "Alias"."bottleId" = "Bottle"."id");
