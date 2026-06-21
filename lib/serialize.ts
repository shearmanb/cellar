import type { Bottle, Alias, Release } from "@prisma/client";

export type BottleWithRelations = Bottle & { aliases: Alias[]; releases: Release[] };

// Canonical API shape served at GET /api/bottles — the contract for all apps.
export function toApiBottle(b: BottleWithRelations) {
  return {
    id: b.id,
    name: b.name,
    brand: b.brand,
    distillery: b.distillery,
    category: b.category,
    tier: b.tier,
    myTier: b.myTier,
    vabcCode: b.vabcCode,
    ndp: b.ndp,
    vabcAllocated: b.vabcAllocated,
    addedToVabcAt: formatDateValue(b.addedToVabcAt),
    firstAppearance: formatDateValue(b.firstAppearance),
    msrp: b.msrp === null ? null : Number(b.msrp),
    warn: b.warn,
    notes: b.notes,
    shortcodes: b.aliases.map((a) => a.code),
    releases: b.releases.map((r) => ({
      id: r.id,
      year: r.year,
      batch: r.batch,
      label: r.label,
      notes: r.notes,
    })),
    isArchived: b.isArchived,
    updatedAt: b.updatedAt.toISOString(),
  };
}

// Compatibility shape for Drop Tracker's bottle loader:
// id | name | displayValue | brand | tier | codes(comma-sep) | warn | abcNo
// displayValue is the label the app shows AND its include switch (blank = the
// bottle is not part of Drop Tracker's list).
export function toDropTrackerBottle(b: BottleWithRelations) {
  return {
    id: b.id,
    name: b.name,
    displayValue: b.displayValue ?? "",
    brand: b.brand,
    tier: b.tier ?? "",
    codes: b.aliases.map((a) => a.code).join(","),
    warn: b.warn ?? "",
    abcNo: b.vabcCode ?? "",
  };
}

export function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/\s+/g, "");
}

// Format a date-only DB value as YYYY-MM-DD (UTC), or null. Dates are stored
// as @db.Date (UTC midnight), so the ISO date part is the source of truth.
export function formatDateValue(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// Parse a date-only input ("YYYY-MM-DD") into a Date at UTC midnight so it
// round-trips through an @db.Date column without timezone drift. Empty → null;
// a non-empty but unparseable value throws (surfaced to the user).
export function parseDateValue(v: string | null, label: string): Date | null {
  if (!v) return null;
  const t = v.trim();
  if (t === "") return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00.000Z` : t;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} must be a date (YYYY-MM-DD)`);
  return d;
}

// Lenient truthy parse for CSV boolean cells: true/1/yes/y/x/t (any case).
export function parseBoolValue(v: string | null): boolean {
  return v !== null && /^(1|true|yes|y|x|t)$/i.test(v.trim());
}
