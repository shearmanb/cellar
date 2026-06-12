import { isAuthorized } from "@/lib/auth";
import { syncAllStores, configuredStores } from "@/lib/sync";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Trigger a pull of all configured stores (SYNC_STORES env). Useful for an
// external cron (e.g. Railway scheduled service or cron-job.org):
//   curl -X POST -H "Authorization: Bearer $CELLAR_API_TOKEN" .../api/sync
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (configuredStores().length === 0) {
    return NextResponse.json(
      { error: "No stores configured — set SYNC_STORES env var" },
      { status: 400 }
    );
  }
  const results = await syncAllStores();
  return NextResponse.json({ results });
}
