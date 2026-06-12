// Suspected-duplicate detection for the /dupes review tab.
// Same brand (case-insensitive) + high name similarity (Dice coefficient
// over character bigrams), or identical normalized names.

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

// Bottles whose names contain different numbers (ages, proofs, batch
// numbers, years, sizes) are almost always distinct products, not dupes —
// e.g. Knob Creek 9 vs 12 Year, Pappy 15 vs 20, Batch 1 vs Batch 2.
function numericTokens(s: string): string {
  return (s.match(/\d+/g) ?? []).sort().join(",");
}

export type DupeCandidate<B> = { a: B; b: B; score: number };

export function findDupePairs<B extends { id: number; name: string; brand: string }>(
  bottles: B[],
  threshold = 0.82
): DupeCandidate<B>[] {
  const byBrand = new Map<string, B[]>();
  for (const b of bottles) {
    const key = b.brand.trim().toLowerCase();
    (byBrand.get(key) ?? byBrand.set(key, []).get(key)!).push(b);
  }
  const pairs: DupeCandidate<B>[] = [];
  for (const group of byBrand.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (numericTokens(group[i].name) !== numericTokens(group[j].name)) continue;
        const score = nameSimilarity(group[i].name, group[j].name);
        if (score >= threshold) {
          const [a, b] = group[i].id < group[j].id ? [group[i], group[j]] : [group[j], group[i]];
          pairs.push({ a, b, score });
        }
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}
