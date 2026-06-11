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

// Compatibility shape matching Drop Tracker's parseBottle():
// id | name | brand | tier | codes(comma-sep) | warn | abcNo
export function toDropTrackerBottle(b: BottleWithRelations) {
  return {
    id: b.id,
    name: b.name,
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
