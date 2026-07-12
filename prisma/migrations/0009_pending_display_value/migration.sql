-- Optional Drop Tracker label on queued rows: set in /queue edit mode or
-- posted by apps (e.g. Drop Tracker sending parsed bottles for QC), and copied
-- onto the minted bottle when the row is accepted.
ALTER TABLE "PendingBottle" ADD COLUMN "displayValue" TEXT;
