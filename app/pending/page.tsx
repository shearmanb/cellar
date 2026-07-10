import { prisma } from "@/lib/prisma";
import {
  matchPending,
  createBottleFromPending,
  ignorePending,
  runStoreSync,
} from "@/lib/actions/pending";
import { configuredStores } from "@/lib/sync";

export const dynamic = "force-dynamic";

export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; syncerror?: string }>;
}) {
  const { synced, syncerror } = await searchParams;
  const [pending, bottles] = await Promise.all([
    prisma.pendingBottle.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bottle.findMany({
      where: { isArchived: false },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
      select: { id: true, name: true, brand: true },
    }),
  ]);

  return (
    <>
      <h1>Pending review</h1>
      <p className="muted">
        Listings submitted by consuming apps (e.g. Beacon) that aren&apos;t mapped to a
        canonical bottle yet. Match them to an existing bottle, mint a new one, or ignore.
        Bookmarklet / paste captures are quicker to clear from the <a href="/queue">📱 mobile
        queue</a> (yes / no / maybe).
      </p>

      {configuredStores().length > 0 ? (
        <form action={runStoreSync} className="toolbar">
          <button type="submit">
            Check stores now ({configuredStores().map((s) => s.store).join(", ")})
          </button>
        </form>
      ) : (
        <p className="muted">
          Tip: set the <code>SYNC_STORES</code> env var (e.g.{" "}
          <code>thereveries=https://store-url</code>) to let Cellar poll Shopify stores
          for new products directly.
        </p>
      )}
      {synced !== undefined ? (
        <p className="success">Sync complete — {synced} new listing(s) queued.</p>
      ) : null}
      {syncerror ? <p className="error">Sync errors: {syncerror}</p> : null}

      {pending.length === 0 ? <p className="success">Queue is empty 🎉</p> : null}

      {pending.map((p) => {
        const matchAction = async (form: FormData) => {
          "use server";
          const bottleId = Number(form.get("bottleId"));
          if (Number.isInteger(bottleId) && bottleId > 0) {
            await matchPending(p.id, bottleId);
          }
        };
        return (
          <div key={p.id} className="card">
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" width={64} style={{ borderRadius: 6 }} />
              ) : null}
              <div style={{ flex: 1 }}>
                <strong>{p.title}</strong>
                <div className="muted">
                  {p.store} · <code>{p.handle}</code>
                  {p.vendor ? <> · {p.vendor}</> : null}
                  {p.price !== null ? <> · ${String(p.price)}</> : null}
                  {p.url ? (
                    <>
                      {" "}
                      · <a href={p.url}>listing ↗</a>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="actions" style={{ flexWrap: "wrap" }}>
              <form action={matchAction} style={{ display: "flex", gap: "0.5rem" }}>
                <select name="bottleId" required defaultValue="">
                  <option value="" disabled>
                    Match to existing bottle…
                  </option>
                  {bottles.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.id} — {b.brand} {b.name}
                    </option>
                  ))}
                </select>
                <button type="submit">Match</button>
              </form>

              <form
                action={createBottleFromPending.bind(null, p.id)}
                style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
              >
                <input name="name" type="text" defaultValue={p.title} style={{ minWidth: "16rem" }} />
                <input name="brand" type="text" defaultValue={p.vendor ?? ""} placeholder="Brand" />
                <button type="submit" className="secondary">
                  Create new bottle
                </button>
              </form>

              <form action={ignorePending.bind(null, p.id)}>
                <button type="submit" className="secondary">
                  Ignore
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </>
  );
}
