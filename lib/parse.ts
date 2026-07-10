// Parsing helpers for the Quick-Add flow — the /add paste page and the
// bookmarklet. Deliberately pure and isomorphic: no DB or server-only imports,
// so the exact same code prefills fields in the browser and could be unit
// tested in isolation. brandKey is a type-only-transitive import (safe in the
// client bundle) so brand matching stays consistent with the rest of the app.
//
// Entry points (both return the same ParsedBottle shape):
//   parsePaste(text, knownBrands)             — a human pasted a title / notes / JSON
//   parseBookmarkletPayload(payload, brands)  — the bookmarklet's `#p=` hash blob
import { brandKey } from "@/lib/brand-rules";

// String fields (not the Bottle model) — everything is form-input ready, so
// msrp is a numeric string and shortcodes are comma-separated.
export type ParsedBottle = {
  name: string;
  brand: string;
  distillery: string;
  category: string;
  msrp: string;
  shortcodes: string;
  notes: string;
  url: string; // provenance; folded into notes on save (Bottle has no url column)
  image: string; // preview only, to confirm the right product; never stored
  source: string; // "text" | "key-value" | "json-ld" | "bookmarklet" — a UI hint
};

export function emptyParsed(): ParsedBottle {
  return {
    name: "",
    brand: "",
    distillery: "",
    category: "",
    msrp: "",
    shortcodes: "",
    notes: "",
    url: "",
    image: "",
    source: "",
  };
}

// Volume tokens (750ml, 1.75L, 50 mL, 12oz) carry no catalog identity.
const SIZE_RE = /\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/gi;
const URL_RE = /https?:\/\/[^\s)]+/i;
// A price needs a currency marker so we don't mistake an age/proof for a price.
const PRICE_RE = /(?:\$|usd|us\$)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;

// Pull a clean numeric string out of anything price-shaped ("$1,299.00" → "1299").
function toPrice(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const m = s.match(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/);
  if (!m) return "";
  const num = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(num) ? String(num) : "";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// JSON-LD `image` can be a string, an object, or an array of either.
function firstStr(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstStr(x);
      if (s) return s;
    }
    return "";
  }
  if (v && typeof v === "object" && "url" in v) return str((v as { url: unknown }).url);
  return "";
}

// Category is a best-effort guess from keywords; the user can always correct it.
// Order matters — specific styles before the generic "whiskey" catch-all.
const CATEGORY_HINTS: [RegExp, string][] = [
  [/\brye\b/i, "Rye"],
  [/\bbourbon\b/i, "Bourbon"],
  [/\b(single malt|scotch|islay|speyside|highland)\b/i, "Scotch"],
  [/\birish\b/i, "Irish"],
  [/\b(japanese|yamazaki|hakushu|nikka|hibiki)\b/i, "Japanese"],
  [/\b(tequila|mezcal|blanco|reposado|a[ñn]ejo)\b/i, "Tequila"],
  [/\brum\b/i, "Rum"],
  [/\b(cognac|armagnac|brandy)\b/i, "Brandy"],
  [/\bgin\b/i, "Gin"],
  [/\bvodka\b/i, "Vodka"],
  [/\b(whiskey|whisky)\b/i, "American Whiskey"],
];

function guessCategory(text: string): string {
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return "";
}

// Longest known brand that is a leading, word-boundary prefix of the name.
// "Buffalo Trace Kosher Wheat…" → "Buffalo Trace" when that brand exists.
function detectBrand(name: string, knownBrands: string[]): string {
  const n = brandKey(name);
  if (!n) return "";
  let best = "";
  let bestLen = 0;
  for (const b of knownBrands) {
    const bk = brandKey(b);
    if (!bk || bk.length <= bestLen) continue;
    if (n === bk || n.startsWith(bk + " ")) {
      best = b.trim();
      bestLen = bk.length;
    }
  }
  return best;
}

// A single messy title / notes blob → fields. Extracts a price and URL, drops
// size tokens, guesses category, and matches a leading brand.
export function parseFreeText(raw: string, knownBrands: string[] = []): ParsedBottle {
  const out = emptyParsed();
  out.source = "text";
  const text = (raw || "").trim();
  if (!text) return out;

  const um = text.match(URL_RE);
  if (um) out.url = um[0];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Title = first line that isn't just a bare URL; the rest becomes notes.
  let titleIdx = lines.findIndex((l) => !/^https?:\/\/\S+$/i.test(l));
  if (titleIdx < 0) titleIdx = 0;
  let title = lines[titleIdx] ?? "";
  const rest = lines
    .filter((_, i) => i !== titleIdx)
    .filter((l) => !/^https?:\/\/\S+$/i.test(l))
    .join("\n")
    .trim();

  const pm = title.match(PRICE_RE);
  if (pm) {
    out.msrp = toPrice(pm[1]);
    title = title.replace(pm[0], " ");
  }

  title = title
    .replace(SIZE_RE, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s|•·,\-–—]+$/u, "")
    .trim();

  out.name = title;
  out.brand = detectBrand(title, knownBrands);
  out.category = guessCategory(text);
  out.notes = rest;
  return out;
}

// Recognized "Key: value" lines. Anything unrecognized falls to notes.
const KEY_MAP: Record<string, keyof ParsedBottle> = {
  name: "name",
  title: "name",
  brand: "brand",
  producer: "brand",
  vendor: "brand",
  distillery: "distillery",
  distiller: "distillery",
  category: "category",
  type: "category",
  style: "category",
  price: "msrp",
  msrp: "msrp",
  cost: "msrp",
  note: "notes",
  notes: "notes",
  description: "notes",
  desc: "notes",
  code: "shortcodes",
  codes: "shortcodes",
  shortcode: "shortcodes",
  shortcodes: "shortcodes",
  alias: "shortcodes",
  aliases: "shortcodes",
  url: "url",
  link: "url",
  source: "url",
  image: "image",
  img: "image",
  photo: "image",
};

// "Name: X / Brand: Y / Notes: …" style paste. Returns null (so the caller
// falls back to free-text) unless it found recognized keys and a name.
function parseKeyValue(lines: string[], knownBrands: string[]): ParsedBottle | null {
  const out = emptyParsed();
  out.source = "key-value";
  const extra: string[] = [];
  const noteParts: string[] = [];
  let hit = false;

  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z ]{0,18}?)\s*:\s*(.+)$/);
    const key = m ? KEY_MAP[m[1].trim().toLowerCase()] : undefined;
    if (!m || !key) {
      extra.push(line);
      continue;
    }
    hit = true;
    const value = m[2].trim();
    if (key === "notes") noteParts.push(value);
    else if (key === "msrp") out.msrp = toPrice(value);
    else out[key] = value;
  }

  if (!hit) return null;
  const notes = [...noteParts, ...extra].join("\n").trim();
  out.notes = notes;
  if (!out.name) return null; // not really structured — let free-text try
  if (!out.brand) out.brand = detectBrand(out.name, knownBrands);
  if (!out.category) out.category = guessCategory([out.name, notes].join(" "));
  return out;
}

function tryJson(raw: string): unknown {
  const t = (raw || "").trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

type LdNode = Record<string, unknown>;

function firstProduct(node: unknown): LdNode | null {
  if (!node || typeof node !== "object") return null;
  const n = node as LdNode;
  const types = ([] as unknown[]).concat(n["@type"] ?? []);
  if (types.some((t) => typeof t === "string" && t.toLowerCase().includes("product"))) return n;
  const graph = n["@graph"];
  if (Array.isArray(graph)) {
    for (const g of graph) {
      const p = firstProduct(g);
      if (p) return p;
    }
  }
  return null;
}

// Schema.org Product (JSON-LD) → fields. Store product pages expose name,
// brand, price and image here far more reliably than the visible markup.
function fromJsonLd(obj: unknown, knownBrands: string[]): ParsedBottle | null {
  const nodes = Array.isArray(obj) ? obj : [obj];
  let prod: LdNode | null = null;
  for (const node of nodes) {
    prod = firstProduct(node);
    if (prod) break;
  }
  if (!prod) return null;

  const out = emptyParsed();
  out.source = "json-ld";
  out.name = str(prod.name);
  const brand = prod.brand;
  out.brand =
    brand && typeof brand === "object" ? str((brand as LdNode).name) : str(brand);
  out.image = firstStr(prod.image);
  out.notes = str(prod.description);
  const offers = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
  const offer = (offers ?? {}) as LdNode;
  out.msrp = toPrice((offer.price ?? offer.lowPrice ?? prod.price) as string | number);
  out.url = str(prod.url) || str(offer.url);
  if (!out.brand) out.brand = detectBrand(out.name, knownBrands);
  if (!out.category) out.category = guessCategory([out.name, out.notes].join(" "));
  return out.name ? out : null;
}

// The JSON object the bookmarklet stuffs into the URL hash.
type Payload = {
  title?: string;
  url?: string;
  selection?: string;
  ogTitle?: string;
  ogImage?: string;
  price?: string;
  vendor?: string;
  ld?: string;
};

function looksLikePayload(o: unknown): o is Payload {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const k = o as Record<string, unknown>;
  return ("selection" in k || "ogTitle" in k || "ld" in k) && ("url" in k || "title" in k);
}

function parsePayloadObject(p: Payload, knownBrands: string[]): ParsedBottle {
  const selection = (p.selection || "").trim();
  // A short single-line selection is probably a title; a long/multiline one is
  // notes the user deliberately highlighted.
  const selShort = selection !== "" && !selection.includes("\n") && selection.length <= 120;

  const ld = p.ld ? fromJsonLd(tryJson(p.ld), knownBrands) : null;
  const titleText = ld?.name || p.ogTitle || (selShort ? selection : "") || p.title || "";

  const base = parseFreeText(titleText, knownBrands);
  base.source = "bookmarklet";

  if (selection && !selShort) base.notes = selection.slice(0, 2000);
  else if (!base.notes && ld?.notes) base.notes = ld.notes.slice(0, 2000);

  base.url = base.url || p.url || ld?.url || "";
  base.image = base.image || p.ogImage || ld?.image || "";
  if (!base.brand) base.brand = ld?.brand || str(p.vendor);
  if (!base.msrp) base.msrp = ld?.msrp || toPrice(p.price);
  if (!base.category) base.category = ld?.category || "";
  if (!base.brand) base.brand = detectBrand(base.name, knownBrands);
  return base;
}

export function parseBookmarkletPayload(payload: string, knownBrands: string[] = []): ParsedBottle {
  const obj = tryJson(payload);
  if (!looksLikePayload(obj)) return emptyParsed();
  return parsePayloadObject(obj, knownBrands);
}

// Top-level dispatch for the manual paste box: JSON (bookmarklet payload or raw
// JSON-LD) → key:value notes → plain title/notes text.
export function parsePaste(raw: string, knownBrands: string[] = []): ParsedBottle {
  const text = (raw || "").trim();
  if (!text) return emptyParsed();

  const json = tryJson(text);
  if (json) {
    if (looksLikePayload(json)) return parsePayloadObject(json, knownBrands);
    const ld = fromJsonLd(json, knownBrands);
    if (ld) return ld;
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const kv = parseKeyValue(lines, knownBrands);
  if (kv) return kv;

  return parseFreeText(text, knownBrands);
}
