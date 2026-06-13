import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BottleForm } from "@/components/bottle-form";
import { updateBottle, setArchived, addRelease, deleteRelease } from "@/lib/actions/bottles";
import { formatDateValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function EditBottlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id)) notFound();

  const bottle = await prisma.bottle.findUnique({
    where: { id },
    include: { aliases: true, releases: { orderBy: { id: "asc" } }, listings: true },
  });
  if (!bottle) notFound();

  const updateAction = updateBottle.bind(null, id);
  const archiveAction = setArchived.bind(null, id, !bottle.isArchived);
  const addReleaseAction = addRelease.bind(null, id);

  return (
    <>
      <h1>
        Edit #{bottle.id}: {bottle.name}
        {bottle.isArchived ? <span className="muted"> (archived)</span> : null}
      </h1>
      <BottleForm
        action={updateAction}
        submitLabel="Save changes"
        initial={{
          name: bottle.name,
          brand: bottle.brand,
          distillery: bottle.distillery,
          category: bottle.category,
          tier: bottle.tier,
          myTier: bottle.myTier,
          vabcCode: bottle.vabcCode,
          vabcAllocated: bottle.vabcAllocated,
          addedToVabcAt: formatDateValue(bottle.addedToVabcAt),
          firstAppearance: formatDateValue(bottle.firstAppearance),
          msrp: bottle.msrp === null ? null : String(bottle.msrp),
          warn: bottle.warn,
          notes: bottle.notes,
          shortcodes: bottle.aliases.map((a) => a.code).join(", "),
        }}
      />

      <div className="card" style={{ marginTop: "2rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Releases</h2>
        {bottle.releases.length === 0 ? (
          <p className="muted">No specific releases — apps reference the expression itself.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Year</th>
                <th>Batch</th>
                <th>Label</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bottle.releases.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{r.id}</td>
                  <td>{r.year}</td>
                  <td>{r.batch}</td>
                  <td>{r.label}</td>
                  <td>
                    <form action={deleteRelease.bind(null, id, r.id)}>
                      <button type="submit" className="secondary">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addReleaseAction} className="toolbar" style={{ marginTop: "0.75rem" }}>
          <input name="year" type="text" placeholder="Year (2025)" style={{ width: "8rem" }} />
          <input name="batch" type="text" placeholder="Batch (C925)" style={{ width: "8rem" }} />
          <input name="label" type="text" placeholder="Label override" />
          <button type="submit" className="secondary">
            + Add release
          </button>
        </form>
      </div>

      {bottle.listings.length > 0 ? (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Store listings mapped here</h2>
          <table>
            <thead>
              <tr>
                <th>Store</th>
                <th>Handle</th>
              </tr>
            </thead>
            <tbody>
              {bottle.listings.map((l) => (
                <tr key={l.id}>
                  <td>{l.store}</td>
                  <td>
                    {l.url ? <a href={l.url}>{l.handle}</a> : <code>{l.handle}</code>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form action={archiveAction} className="actions">
        <button type="submit" className="secondary">
          {bottle.isArchived ? "Unarchive" : "Archive"} bottle
        </button>
        <span className="muted">
          Bottles are never deleted — other apps reference this id.
        </span>
      </form>
    </>
  );
}
