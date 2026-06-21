import type { BrandRule } from "@prisma/client";

// Normalized match key for a brand: lowercased, trimmed, internal whitespace
// collapsed. This is what BrandRule.brandKey stores and what we match against.
export function brandKey(brand: string): string {
  return brand.toLowerCase().trim().replace(/\s+/g, " ");
}

export type RuleableData = {
  brand: string;
  distillery: string | null;
  category: string | null;
  ndp: boolean;
};

// Apply a brand rule as *fill-the-blanks* defaults, mutating and returning data.
// - distillery/category: only filled when currently blank (explicit values win).
// - ndp: applied only when the caller didn't get an explicit value (ndpExplicit
//   = false), so a manually-set checkbox / CSV cell always wins.
export function applyBrandRule<T extends RuleableData>(
  data: T,
  rule: BrandRule | undefined,
  ndpExplicit: boolean
): T {
  if (!rule) return data;
  if (data.distillery == null && rule.distillery != null) data.distillery = rule.distillery;
  if (data.category == null && rule.category != null) data.category = rule.category;
  if (!ndpExplicit && rule.ndp != null) data.ndp = rule.ndp;
  return data;
}
