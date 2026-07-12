// The synthetic PendingBottle.store value for bookmarklet / paste captures.
// Kept out of the "use server" actions file (which may only export async
// functions) so both the actions and the /queue page can import it.
export const QUICKADD_STORE = "quickadd";

// Stores triaged on the mobile /queue rather than the desktop /pending. These
// are operator inboxes, not real shops: resolving them never writes a
// StoreListing (that mapping is Beacon's cross-store dedupe layer).
// "droptracker" is the agreed store id for Drop Tracker posting its parsed
// bottles to POST /api/pending for QC before they join the catalog.
export const TRIAGE_STORES: readonly string[] = [QUICKADD_STORE, "droptracker"];
