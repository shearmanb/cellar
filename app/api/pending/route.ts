import { prisma } from "@/lib/prisma";
import { isAuthorized } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// CORS for browser callers. The Beacon dashboard pushes bottles straight from
// its static GitHub Pages page, which (because of the Authorization header)
// triggers a CORS preflight. Auth here is a Bearer token, not a cookie, so a
// wildcard origin is safe; set CELLAR_CORS_ORIGIN to a comma-separated allowlist
// to restrict it (the matching request origin is echoed back, else the first
// entry). Server-to-server callers ignore these headers entirely.
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = process.env.CELLAR_CORS_ORIGIN;
  let allowOrigin = "*";
  if (allow) {
    const list = allow.split(",").map((s) => s.trim()).filter(Boolean);
    allowOrigin = list.includes(origin) ? origin : list[0] ?? "*";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request) {
  const pending = await prisma.pendingBottle.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ pending }, { headers: corsHeaders(req) });
}

// The single inbound write path for consuming apps. Beacon posts listings
// it can't map to a bottleId. Requires Authorization: Bearer <token>.
// Body: { store, handle, title, vendor?, url?, image?, price? }
// Idempotent on (store, handle); re-posting an IGNORED/MATCHED item is a no-op.
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }
  const store = typeof body.store === "string" ? body.store.trim() : "";
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!store || !handle || !title) {
    return NextResponse.json(
      { error: "store, handle, and title are required" },
      { status: 400, headers: cors }
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
    return NextResponse.json(
      { status: "already-mapped", bottleId: existing.bottleId },
      { headers: cors }
    );
  }

  const pending = await prisma.pendingBottle.upsert({
    where: { store_handle: { store, handle } },
    create: { store, handle, title, ...optional },
    update: { title, ...optional },
  });
  return NextResponse.json(
    { status: pending.status.toLowerCase(), id: pending.id },
    { headers: cors }
  );
}
