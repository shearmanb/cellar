import { prisma } from "@/lib/prisma";
import { toDropTrackerBottle } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Drop Tracker is a static page on github.io that fetches this cross-origin,
// so the response must be CORS-readable. Reads are open, matching /api/bottles.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Compatibility endpoint for Drop Tracker. Each bottle carries the fields its
// loader reads (id, name, displayValue, brand, tier, codes, warn, abcNo).
// A bottle is part of Drop Tracker's list only when it has a displayValue, so
// this feed is the curated hunt list — not Cellar's full catalog.
export async function GET() {
  const bottles = await prisma.bottle.findMany({
    where: { isArchived: false, displayValue: { not: null } },
    include: { aliases: true, releases: true },
    orderBy: { id: "asc" },
  });
  const visible = bottles.filter((b) => (b.displayValue ?? "").trim() !== "");
  return NextResponse.json(
    { bottles: visible.map(toDropTrackerBottle) },
    { headers: CORS }
  );
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
