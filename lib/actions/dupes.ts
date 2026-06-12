"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Merge loser into keeper: move aliases, listings, releases, and pending
// resolutions across, then soft-archive the loser. Ids are immutable —
// the loser stays in the DB (archived) so any external references survive.
export async function mergeBottles(keeperId: number, loserId: number) {
  if (keeperId === loserId) return;
  const loser = await prisma.bottle.findUniqueOrThrow({ where: { id: loserId } });
  await prisma.$transaction([
    prisma.alias.updateMany({ where: { bottleId: loserId }, data: { bottleId: keeperId } }),
    prisma.storeListing.updateMany({ where: { bottleId: loserId }, data: { bottleId: keeperId } }),
    prisma.release.updateMany({ where: { bottleId: loserId }, data: { bottleId: keeperId } }),
    prisma.pendingBottle.updateMany({
      where: { resolvedBottleId: loserId },
      data: { resolvedBottleId: keeperId },
    }),
    prisma.bottle.update({
      where: { id: loserId },
      data: {
        isArchived: true,
        notes: [loser.notes, `Merged into #${keeperId}`].filter(Boolean).join(" | "),
      },
    }),
  ]);
  revalidatePath("/dupes");
  revalidatePath("/bottles");
}

export async function dismissDupe(aId: number, bId: number) {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  await prisma.dupeReview.upsert({
    where: { aId_bId: { aId: lo, bId: hi } },
    create: { aId: lo, bId: hi },
    update: {},
  });
  revalidatePath("/dupes");
}
