import { prisma } from "@/lib/prisma";
import { findDupePairs } from "@/lib/dupes";
import { mergeBottles, dismissDupe } from "@/lib/actions/dupes";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DupesPage() {
  const [bottles, dismissed] = await Promise.all([
    prisma.bottle.findMany({
      where: { isArchived: false },
      include: { aliases: true, listings: true },
    }),
    prisma.dupeReview.findMany(),
  ]);

  const dismissedSet = new Set(dismissed.map((d) => `${d.aId}:${d.bId}`));
  const pairs = findDupePairs(bottles).filter(
    (p) => !dismissedSet.has(`${p.a.id}:${p.b.id}`)
  );

  return (
    <>
      <h1>Suspected duplicates</h1>
      <p className="muted">
        Same brand + very similar names. Keeping one merges the other&apos;s shortcodes,
        store mappings, and releases into it, then archives it (ids are never deleted).
        &quot;Not a dupe&quot; hides the pair permanently.
      </p>

      {pairs.length === 0 ? (
        <p className="success">No suspected duplicates 🎉</p>
      ) : (
        <p className="muted">{pairs.length} suspected pair(s)</p>
      )}

      {pairs.map(({ a, b, score }) => (
        <div key={`${a.id}-${b.id}`} className="card">
          <div className="muted" style={{ marginBottom: "0.5rem" }}>
            similarity {(score * 100).toFixed(0)}%
          </div>
          <table>
            <tbody>
              {[a, b].map((x) => (
                <tr key={x.id}>
                  <td className="muted" style={{ width: "3rem" }}>#{x.id}</td>
                  <td>
                    <Link href={`/bottles/${x.id}/edit`}>{x.name}</Link>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {x.brand}
                      {x.vabcCode ? <> · VABC {x.vabcCode}</> : null}
                      {x.msrp !== null ? <> · ${String(x.msrp)}</> : null}
                      {x.listings.length > 0 ? <> · {x.listings.length} store mapping(s)</> : null}
                    </div>
                  </td>
                  <td>
                    {x.aliases.map((al) => (
                      <span key={al.id} className="code-chip">{al.code}</span>
                    ))}
                  </td>
                  <td style={{ width: "9rem" }}>
                    <form action={mergeBottles.bind(null, x.id, x.id === a.id ? b.id : a.id)}>
                      <button type="submit" className="secondary">Keep this one</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="actions">
            <form action={dismissDupe.bind(null, a.id, b.id)}>
              <button type="submit" className="secondary">Not a dupe</button>
            </form>
          </div>
        </div>
      ))}
    </>
  );
}
