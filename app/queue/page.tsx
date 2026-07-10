import { prisma } from "@/lib/prisma";
import { brandKey } from "@/lib/brand-rules";
import { nameSimilarity } from "@/lib/dupes";
import { addGateEnabled, isAddUnlocked } from "@/lib/gate";
import { QUICKADD_STORE } from "@/lib/queue";
import { QueueTriage, type QueueItem } from "@/components/queue-triage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cellar — Queue" };

export default async function QueuePage() {
  const [rows, bottles, unlocked] = await Promise.all([
    prisma.pendingBottle.findMany({
      where: { store: QUICKADD_STORE, status: { in: ["PENDING", "MAYBE"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bottle.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, brand: true },
    }),
    isAddUnlocked(),
  ]);

  // Best existing-bottle candidate — an advisory "looks like this" so a Yes can
  // map to an existing bottle instead of minting a duplicate.
  function bestMatch(title: string, vendor: string | null): QueueItem["match"] {
    const n = title.trim();
    if (n.length < 3) return null;
    const bk = vendor ? brandKey(vendor) : "";
    let best: QueueItem["match"] = null;
    let bestScore = 0;
    for (const b of bottles) {
      let score = nameSimilarity(n, b.name);
      if (bk && bk === brandKey(b.brand)) score += 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = { id: b.id, name: b.name, brand: b.brand };
      }
    }
    return bestScore >= 0.6 ? best : null;
  }

  // Prisma Decimal isn't serializable across the server/client boundary — send
  // price as a plain string.
  const toItem = (p: (typeof rows)[number]): QueueItem => ({
    id: p.id,
    title: p.title,
    vendor: p.vendor,
    price: p.price === null ? null : String(p.price),
    image: p.image,
    url: p.url,
    category: p.category,
    notes: p.notes,
    shortcodes: p.shortcodes,
    match: bestMatch(p.title, p.vendor),
  });

  return (
    <QueueTriage
      items={rows.filter((r) => r.status === "PENDING").map(toItem)}
      maybe={rows.filter((r) => r.status === "MAYBE").map(toItem)}
      gated={addGateEnabled()}
      unlocked={unlocked}
    />
  );
}
