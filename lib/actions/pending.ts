"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Match a pending listing to an existing bottle and record the mapping.
export async function matchPending(pendingId: number, bottleId: number) {
  const pending = await prisma.pendingBottle.findUniqueOrThrow({ where: { id: pendingId } });
  await prisma.$transaction([
    prisma.storeListing.upsert({
      where: { store_handle: { store: pending.store, handle: pending.handle } },
      create: {
        store: pending.store,
        handle: pending.handle,
        bottleId,
        title: pending.title,
        url: pending.url,
      },
      update: { bottleId, title: pending.title, url: pending.url },
    }),
    prisma.pendingBottle.update({
      where: { id: pendingId },
      data: { status: "MATCHED", resolvedBottleId: bottleId },
    }),
  ]);
  revalidatePath("/pending");
}

// Mint a new catalog bottle from a pending listing, then map it.
export async function createBottleFromPending(pendingId: number, form: FormData) {
  const pending = await prisma.pendingBottle.findUniqueOrThrow({ where: { id: pendingId } });
  const name = String(form.get("name") ?? "").trim() || pending.title;
  const brand = String(form.get("brand") ?? "").trim() || pending.vendor || "Unknown";
  const bottle = await prisma.bottle.create({ data: { name, brand } });
  await matchPending(pendingId, bottle.id);
  revalidatePath("/bottles");
}

// Manual "check stores now" from the pending page.
export async function runStoreSync() {
  const { syncAllStores } = await import("@/lib/sync");
  const results = await syncAllStores();
  revalidatePath("/pending");
  const queued = results.reduce((n, r) => n + r.queued, 0);
  const errors = results.filter((r) => r.error).map((r) => `${r.store}: ${r.error}`);
  const { redirect } = await import("next/navigation");
  redirect(
    `/pending?synced=${queued}${errors.length ? `&syncerror=${encodeURIComponent(errors.join("; "))}` : ""}`
  );
}

export async function ignorePending(pendingId: number) {
  await prisma.pendingBottle.update({
    where: { id: pendingId },
    data: { status: "IGNORED" },
  });
  revalidatePath("/pending");
}
