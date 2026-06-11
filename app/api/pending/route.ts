import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const pending = await prisma.pendingBottle.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ pending });
}

// The single inbound write path for consuming apps. Beacon posts listings
// it can't map to a bottleId. Requires Authorization: Bearer <token>.
// Body: { store, handle, title, vendor?, url?, image?, price? }
// Idempotent on (store, handle); re-posting an IGNORED/MATCHED item is a no-op.
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const store = typeof body.store === "string" ? body.store.trim() : "";
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!store || !handle || !title) {
    return NextResponse.json(
      { error: "store, handle, and title are required" },
      { status: 400 }
    );
  }
  const price = typeof body.price === "number" && !Number.isNaN(body.price) ? body.price : null;
  const optional = {
    vendor: typeof body.vendor === "string" ? body.vendor : null,
    url: typeof body.url === "string" ? body.url : null,
    image: typeof body.image === "string" ? body.image : null,
    price,
  };

  // Already mapped? Tell the caller the bottleId instead of queueing.
  const existing = await prisma.storeListing.findUnique({
    where: { store_handle: { store, handle } },
  });
  if (existing) {
    return NextResponse.json({ status: "already-mapped", bottleId: existing.bottleId });
  }

  const pending = await prisma.pendingBottle.upsert({
    where: { store_handle: { store, handle } },
    create: { store, handle, title, ...optional },
    update: { title, ...optional },
  });
  return NextResponse.json({ status: pending.status.toLowerCase(), id: pending.id });
}
