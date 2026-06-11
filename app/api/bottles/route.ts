import { prisma } from "@/lib/prisma";
import { toApiBottle } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Canonical catalog read. ?archived=1 includes archived bottles.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("archived") === "1";
  const bottles = await prisma.bottle.findMany({
    where: includeArchived ? {} : { isArchived: false },
    include: { aliases: true, releases: true },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ bottles: bottles.map(toApiBottle) });
}
