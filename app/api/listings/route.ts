import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Beacon's dedupe map: {store, handle} -> canonical bottleId.
// ?store=<siteId> filters to one site.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = url.searchParams.get("store");
  const listings = await prisma.storeListing.findMany({
    where: store ? { store } : {},
    orderBy: [{ store: "asc" }, { handle: "asc" }],
  });
  return NextResponse.json({
    listings: listings.map((l) => ({
      store: l.store,
      handle: l.handle,
      bottleId: l.bottleId,
    })),
  });
}
