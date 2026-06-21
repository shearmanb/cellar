// Shared registry of the optional columns the bottle list can display.
// Both the Control Panel (which toggles them) and the bottles page (which
// renders them, plus a matching filter for every visible field) read from
// this single source so the two stay in sync.
//
// id, name, and the edit action are always shown and not part of this list.

export type ColumnKey =
  | "tier"
  | "displayValue"
  | "brand"
  | "distillery"
  | "category"
  | "myTier"
  | "shortcodes"
  | "vabc"
  | "msrp"
  | "ndp"
  | "warn"
  | "notes";

// How the bottle-list filter row renders the control for this column.
// null = displayed but not filterable on its own (e.g. shortcodes are
// covered by the global search box). "presence" = a set/missing dropdown
// for an optional free-text field (used by the Drop Tracker display value).
export type FilterKind = "tier" | "select" | "text" | "bool" | "range" | "presence" | null;

export type ColumnDef = {
  key: ColumnKey;
  label: string;
  filter: FilterKind;
  // Bottle field a "select" filter draws its distinct options from.
  field?: "brand" | "distillery" | "category";
};

export const COLUMNS: ColumnDef[] = [
  { key: "tier", label: "Tier", filter: "tier" },
  { key: "displayValue", label: "Display (Drop Tracker)", filter: "presence" },
  { key: "brand", label: "Brand", filter: "select", field: "brand" },
  { key: "distillery", label: "Distillery", filter: "select", field: "distillery" },
  { key: "category", label: "Category", filter: "select", field: "category" },
  { key: "myTier", label: "My tier", filter: "tier" },
  { key: "shortcodes", label: "Shortcodes", filter: null },
  { key: "vabc", label: "VABC", filter: "text" },
  { key: "msrp", label: "MSRP", filter: "range" },
  { key: "ndp", label: "NDP", filter: "bool" },
  { key: "warn", label: "Warning", filter: null },
  { key: "notes", label: "Notes", filter: null },
];

// Matches the original bottle-list view, so existing behavior is unchanged
// until the user picks something in the Control Panel.
export const DEFAULT_COLUMNS: ColumnKey[] = ["tier", "displayValue", "brand", "shortcodes", "vabc"];

export const COLUMN_COOKIE = "cellar_cols";

const VALID = new Set<string>(COLUMNS.map((c) => c.key));

// undefined (no saved preference) falls back to defaults; an empty string
// (user saved with everything unchecked) is respected as "only id + name".
export function parseColumns(raw: string | undefined): Set<ColumnKey> {
  if (raw === undefined) return new Set(DEFAULT_COLUMNS);
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ColumnKey => VALID.has(s));
  return new Set(keys);
}
