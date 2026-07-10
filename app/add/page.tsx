import { prisma } from "@/lib/prisma";
import { brandKey } from "@/lib/brand-rules";
import { addGateEnabled, isAddUnlocked } from "@/lib/gate";
import { QuickAddForm } from "@/components/quick-add-form";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const [rules, bottleRows, unlocked] = await Promise.all([
    prisma.brandRule.findMany({
      select: { brand: true, brandKey: true, distillery: true, category: true, ndp: true },
    }),
    prisma.bottle.findMany({
      where: { isArchived: false },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      select: { id: true, name: true, brand: true },
    }),
    isAddUnlocked(),
  ]);
  const gated = addGateEnabled();

  // Brand suggestions for the datalist + the parser's leading-brand detection:
  // every brand already in the catalog, plus any brand-rule brand, deduped by
  // match key (keeping the first display form seen).
  const byKey = new Map<string, string>();
  for (const b of bottleRows) byKey.set(brandKey(b.brand), b.brand);
  for (const r of rules) if (!byKey.has(r.brandKey)) byKey.set(r.brandKey, r.brand);
  const brands = Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <h1>Quick add</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Paste a store title, listing, tasting notes, or JSON and Cellar parses it into a bottle.
        Review the fields, then send it to the review <a href="/queue">queue</a> — you approve or
        discard queued bottles (yes / no / maybe) from your phone. Use the{" "}
        <a href="/bookmarklet">bookmarklet</a> to send whatever page you&apos;re browsing straight
        here.
      </p>
      <QuickAddForm
        brands={brands}
        rules={rules}
        bottles={bottleRows}
        gated={gated}
        unlocked={unlocked}
      />
    </>
  );
}
