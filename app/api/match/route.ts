import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Normalization-as-a-service: resolve freeform tokens to canonical bottles
// so consuming apps don't each reimplement shortcode matching.
// GET /api/match?q=EHT,GTS,weller — tokens split on commas/whitespace/"and".
// Exact alias match first, then unique-prefix fallback.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const tokens = q
    .split(/,|\band\b|\s+/i)
    .map((t) => t.trim())
    .filter((t) => t !== "");

  const aliases = await prisma.alias.findMany({
    include: { bottle: { select: { id: true, name: true, brand: true, tier: true, warn: true } } },
  });
  const exact = new Map(aliases.map((a) => [a.code, a.bottle]));

  const matched: { token: string; bottle: (typeof aliases)[number]["bottle"] }[] = [];
  const unmatched: string[] = [];
  for (const token of tokens) {
    const code = normalizeCode(token);
    let bottle = exact.get(code) ?? null;
    if (!bottle) {
      const prefixHits = aliases.filter((a) => a.code.startsWith(code));
      const ids = new Set(prefixHits.map((a) => a.bottle.id));
      if (ids.size === 1) bottle = prefixHits[0].bottle;
    }
    if (bottle) matched.push({ token, bottle });
    else unmatched.push(token);
  }
  return NextResponse.json({ matched, unmatched });
}
