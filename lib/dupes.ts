// Suspected-duplicate detection for the /dupes review tab.
// Three layers:
//   1. numeric guard — names with different numbers (age/proof/batch/size)
//      are distinct products (Knob Creek 9 vs 12 Year).
//   2. distinctive-token guard — after stripping brand, distillery, and
//      generic whiskey words, if each name has its own distinct core words
//      (e.g. "Locust" vs "Mazal"), they're different releases, not dupes.
//   3. name similarity (Dice coefficient over character bigrams) above a
//      threshold for whatever survives the guards.

const GENERIC_WORDS = new Set([
  "the", "a", "of", "and",
  "bourbon", "whiskey", "whisky", "rye", "straight",
  "year", "years", "yr", "yrs", "month", "months", "old",
  "proof", "barrel", "barrels", "single", "small", "batch",
  "kentucky", "indiana", "tennessee", "company", "co", "distillery",
  "release", "edition", "reserve", "select", "bottled", "bond", "bib",
]);

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Core identity words: name tokens minus brand/distillery tokens, generic
// whiskey vocabulary, and bare numbers.
function coreTokens(name: string, brand: string, distillery: string | null): Set<string> {
  const exclude = new Set([...words(brand), ...(distillery ? words(distillery) : [])]);
  const core = new Set<string>();
  for (const w of words(name)) {
    if (exclude.has(w) || GENERIC_WORDS.has(w) || /^\d+$/.test(w)) continue;
    core.add(w);
  }
  return core;
}

function disjoint(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return false;
  return true;
}

function sameTokens(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false;
  for (const w of a) if (!b.has(w)) return false;
  return true;
}

// Names with different numbers (ages, proofs, batch numbers, years, sizes)
// are almost always distinct products, not dupes.
function numericTokens(s: string): string {
  return (s.match(/\d+/g) ?? []).sort().join(",");
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

export function nameSimilarity(a: string, b: string): number {
  const ba = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  let total = 0;
  for (const [, n] of ba) total += n;
  for (const [, n] of bb) total += n;
  if (total === 0) return 0;
  for (const [g, n] of ba) overlap += Math.min(n, bb.get(g) ?? 0);
  return (2 * overlap) / total;
}

export type DupeCandidate<B> = { a: B; b: B; score: number };

export function findDupePairs<
  B extends { id: number; name: string; brand: string; distillery?: string | null },
>(bottles: B[], threshold = 0.82): DupeCandidate<B>[] {
  const byBrand = new Map<string, B[]>();
  for (const b of bottles) {
    const key = b.brand.trim().toLowerCase();
    (byBrand.get(key) ?? byBrand.set(key, []).get(key)!).push(b);
  }
  const pairs: DupeCandidate<B>[] = [];
  for (const group of byBrand.values()) {
    for (let i = 0; i < group.length; i++) {
      const x = group[i];
      const coreX = coreTokens(x.name, x.brand, x.distillery ?? null);
      for (let j = i + 1; j < group.length; j++) {
        const y = group[j];
        if (numericTokens(x.name) !== numericTokens(y.name)) continue;
        const coreY = coreTokens(y.name, y.brand, y.distillery ?? null);
        if (disjoint(coreX, coreY)) continue;
        // Identical core words (e.g. "Daydream" vs "Daydream", different
        // boilerplate) is a strong dupe signal on its own.
        const score = sameTokens(coreX, coreY) ? 1 : nameSimilarity(x.name, y.name);
        if (score >= threshold) {
          const [a, b] = x.id < y.id ? [x, y] : [y, x];
          pairs.push({ a, b, score });
        }
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
