import { prisma } from "@/lib/prisma";

// Stores Cellar watches directly, configured via env:
//   SYNC_STORES="thereveries=https://www.thereveries.com,otherstore=https://..."
// Each must be a Shopify storefront (public /products.json endpoint).
export function configuredStores(): { store: string; baseUrl: string }[] {
  return (process.env.SYNC_STORES ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf("=");
      return { store: entry.slice(0, i).trim(), baseUrl: entry.slice(i + 1).trim().replace(/\/$/, "") };
    })
    .filter((s) => s.store && s.baseUrl.startsWith("http"));
}

type ShopifyProduct = {
  title: string;
  handle: string;
  vendor?: string;
  images?: { src?: string }[];
  variants?: { price?: string }[];
};

export type SyncResult = {
  store: string;
  fetched: number;
  queued: number;
  error?: string;
};

// Pull a store's full product list and queue anything Cellar doesn't know:
// no StoreListing mapping and no PendingBottle row for (store, handle).
export async function syncStore(store: string, baseUrl: string): Promise<SyncResult> {
  const products: ShopifyProduct[] = [];
  try {
    for (let page = 1; page <= 8; page++) {
      const res = await fetch(`${baseUrl}/products.json?limit=250&page=${page}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${baseUrl}/products.json`);
      const batch = (await res.json())?.products ?? [];
      products.push(...batch);
      if (batch.length < 250) break;
    }
  } catch (e) {
    return { store, fetched: 0, queued: 0, error: e instanceof Error ? e.message : String(e) };
  }

  const handles = products.map((p) => p.handle).filter(Boolean);
  const [mapped, pending] = await Promise.all([
    prisma.storeListing.findMany({ where: { store, handle: { in: handles } }, select: { handle: true } }),
    prisma.pendingBottle.findMany({ where: { store, handle: { in: handles } }, select: { handle: true } }),
  ]);
  const known = new Set([...mapped.map((m) => m.handle), ...pending.map((p) => p.handle)]);

  let queued = 0;
  for (const p of products) {
    if (!p.handle || !p.title || known.has(p.handle)) continue;
    const priceRaw = p.variants?.[0]?.price;
    const price = priceRaw !== undefined && !Number.isNaN(Number(priceRaw)) ? Number(priceRaw) : null;
    await prisma.pendingBottle.create({
      data: {
        store,
        handle: p.handle,
        title: p.title,
        vendor: p.vendor ?? null,
        url: `${baseUrl}/products/${p.handle}`,
        image: p.images?.[0]?.src ?? null,
        price,
      },
    });
    queued++;
  }
  return { store, fetched: products.length, queued };
}

export async function syncAllStores(): Promise<SyncResult[]> {
  const stores = configuredStores();
  const results: SyncResult[] = [];
  for (const { store, baseUrl } of stores) {
    results.push(await syncStore(store, baseUrl));
  }
  return results;
}
