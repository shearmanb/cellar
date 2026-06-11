import { prisma } from "@/lib/prisma";
import { toDropTrackerBottle } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Compatibility endpoint for Drop Tracker: same fields its parseBottle()
// reads today (id, name, brand, tier, codes, warn, abcNo), so migrating is
// just swapping the Apps Script URL for this one.
export async function GET() {
  const bottles = await prisma.bottle.findMany({
    where: { isArchived: false },
    include: { aliases: true, releases: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ bottles: bottles.map(toDropTrackerBottle) });
}
