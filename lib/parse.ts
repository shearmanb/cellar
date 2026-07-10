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

// Whiskey mashbill → category by the US legal-definition dominant grain, e.g.
// "60% Corn, 36% Rye, 4% Malted Barley" → Bourbon. Authoritative over keyword
// guessing, which trips on "36% Rye" or a subreddit tag like r/Bourbon.
function categoryFromMashbill(mashbill: string): string {
  const g = { corn: 0, rye: 0, wheat: 0, malt: 0 };
  const re = /(\d{1,3})\s*%\s*(malted\s+barley|barley|malt|corn|rye|wheat)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(mashbill)) !== null) {
    const pct = Number(m[1]);
    const grain = m[2].toLowerCase();
    if (grain.includes("corn")) g.corn = Math.max(g.corn, pct);
    else if (grain.includes("rye")) g.rye = Math.max(g.rye, pct);
    else if (grain.includes("wheat")) g.wheat = Math.max(g.wheat, pct);
    else g.malt = Math.max(g.malt, pct);
  }
  if (g.corn >= 51) return "Bourbon";
  if (g.rye >= 51) return "Rye";
  if (g.wheat >= 51) return "Wheat Whiskey";
  if (g.malt >= 51) return "Malt Whiskey";
  return g.corn || g.rye || g.wheat || g.malt ? "American Whiskey" : "";
}

// Strip store single-barrel-pick noise so the catalog name is the bottle, not
// the pick: leading "Week 40 – " / "Barrel #12 - ", subreddit tags, in-name
// mashbill fragments ("36% Rye"), and trailing "… Single Barrel Selection" /
// "Store Pick". Bare "Single Barrel" (e.g. Blanton's) is kept — only stripped
// when it's clearly a pick suffix.
function cleanBottleName(raw: string): string {
  return raw
    .replace(/^\s*(week|barrel|pick|batch|cask|selection)\s*#?\s*\d+\s*[–\-—:|]\s*/i, "")
    .replace(/\br\/\w+\b/gi, " ")
    .replace(/\b\d{1,3}\s*%\s*(rye|corn|wheat|malted?\s*barley|barley|malt)\b/gi, " ")
    .replace(
      /\s*[–\-—|]?\s*(single\s*barrel\s*(selection|pick)|barrel\s*(pick|selection|select)|store\s*pick|hand[\s-]*(picked|selected)[\w\s]*|private\s*(selection|barrel))\s*$/i,
      " "
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[–\-—|,]\s*$/u, "")
    .trim();
}

// Best-effort brand from a cleaned name when it isn't already in the catalog:
// the leading proper-noun words before an age/number/spec token. "Penelope
// Estate 10 Year" → "Penelope Estate". Capped at three words; a guess to fix.
function guessBrandFromName(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  let stop = tokens.findIndex(
    (t) => /^\d/.test(t) || /^(single|small|straight|barrel|cask|bottled|bonded|bib)$/i.test(t)
  );
  if (stop < 0) stop = Math.min(2, tokens.length);
  const brand = tokens.slice(0, Math.min(stop, 3)).join(" ").trim();
  return brand.length >= 2 ? brand : "";
}

// A messy paste → fields. Handles a plain title/description and a "Key: value"
// spec sheet (single-barrel picks, review posts) with a mashbill, and always
// lets the tasting notes lead the notes field.
export function parseFreeText(raw: string, knownBrands: string[] = []): ParsedBottle {
  const out = emptyParsed();
  out.source = "text";
  const text = (raw || "").trim();
  if (!text) return out;

  const um = text.match(URL_RE);
  if (um) out.url = um[0];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isUrlLine = (l: string) => /^https?:\/\/\S+$/i.test(l);

  // Split into recognized "Key: value" specs and plain lines.
  const specs: { key: string; field: string | null; value: string }[] = [];
  const plain: string[] = [];
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9'’./ ]{0,28}?)\s*:\s*(.+)$/);
    if (m) specs.push({ key: m[1].trim(), field: classifyKey(m[1]), value: m[2].trim() });
    else plain.push(line);
  }
  const values = (f: string) => specs.filter((s) => s.field === f).map((s) => s.value);

  // Name: an explicit name/title key, else the first non-URL plain line, cleaned.
  const titleLine = plain.find((l) => !isUrlLine(l)) ?? "";
  let name = (values("name")[0] ?? "").trim();
  let priceFromTitle = "";
  if (!name && titleLine) {
    let t = titleLine;
    const pm = t.match(PRICE_RE);
    if (pm) {
      priceFromTitle = toPrice(pm[1]);
      t = t.replace(pm[0], " ");
    }
    name = cleanBottleName(t.replace(SIZE_RE, " "));
  }
  out.name = name;

  // Brand: explicit key → known-brand prefix → leading-words guess.
  out.brand =
    (values("brand")[0] ?? "").trim() || detectBrand(name, knownBrands) || guessBrandFromName(name);

  // Category: mashbill (authoritative) → explicit key → keyword in the name.
  const mashbill = values("mashbill")[0];
  out.category =
    (mashbill ? categoryFromMashbill(mashbill) : "") ||
    (values("category")[0] ?? "").trim() ||
    guessCategory(name);

  if (values("distillery")[0]) out.distillery = values("distillery")[0];
  out.msrp = toPrice(values("msrp")[0]) || priceFromTitle;
  const codes = values("shortcodes").join(", ");
  if (codes) out.shortcodes = codes;
  out.url = out.url || values("url")[0] || "";
  out.image = values("image")[0] || "";

  // Notes: tasting notes first (what people actually want), then leftover prose
  // and spec lines so nothing — mashbill, proof, age, barrel — is lost.
  const tasting = values("notes");
  const extraPlain = plain.filter((l) => l !== titleLine && !isUrlLine(l));
  const leftoverSpecs = specs
    .filter((s) => s.field === null || s.field === "mashbill" || s.field === "distillery")
    .map((s) => `${s.key}: ${s.value}`);
  out.notes = [tasting.join("\n"), extraPlain.join("\n"), leftoverSpecs.join("\n")]
    .filter(Boolean)
    .join("\n")
    .trim()
    .slice(0, 3000);
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

// Map a "Key:" label to a ParsedBottle field (or the special "mashbill"), or
// null when it's spec metadata that should just be preserved in notes.
function classifyKey(rawKey: string): string | null {
  const k = rawKey.trim().toLowerCase();
  if (KEY_MAP[k]) return KEY_MAP[k];
  if (k.includes("tasting note") || k === "nose" || k === "palate" || k === "finish" || k === "taste")
    return "notes";
  if (k.includes("mashbill") || k.includes("mash bill")) return "mashbill";
  if (k === "distillery" || k === "distiller" || k.includes("distilled") || k === "aged in" || k === "bottled in")
    return "distillery";
  return null;
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

  return parseFreeText(text, knownBrands);
}
