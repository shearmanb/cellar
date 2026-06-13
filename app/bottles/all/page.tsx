import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDateValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const dash = <span className="muted">—</span>;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Read-only view of every bottle and every stored field. The compact /bottles
// table shows a curated subset; this one is the "show me everything" grid.
export default async function AllFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; archived?: string }>;
}) {
  const { q = "", tier = "", archived } = await searchParams;
  const showArchived = archived === "1";

  const bottles = await prisma.bottle.findMany({
    where: {
      ...(showArchived ? {} : { isArchived: false }),
      ...(tier ? { tier } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { distillery: { contains: q, mode: "insensitive" } },
              { aliases: { some: { code: { contains: q.toLowerCase() } } } },
            ],
          }
        : {}),
    },
    include: { aliases: true, releases: true, listings: true },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
  });

  // Carry the active filters across the Compact ↔ All fields toggle.
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (tier) qs.set("tier", tier);
  if (showArchived) qs.set("archived", "1");
  const suffix = qs.toString() ? `?${qs}` : "";

  return (
    <>
      <h1>All fields</h1>
      <div className="toolbar">
        <div className="view-toggle">
          <Link href={`/bottles${suffix}`}>Compact</Link>
          <Link href={`/bottles/all${suffix}`} className="active">
            All fields
          </Link>
        </div>
        <form action="/bottles/all" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="search"
            name="q"
            placeholder="Search name, brand, shortcode…"
            defaultValue={q}
            style={{ minWidth: "16rem" }}
          />
          <select name="tier" defaultValue={tier}>
            <option value="">All tiers</option>
            <option value="S">S</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} />
            <span className="muted">archived</span>
          </label>
          <button type="submit" className="secondary">
            Filter
          </button>
        </form>
        <Link href="/bottles/new" className="btn">
          + New bottle
        </Link>
      </div>

      <p className="muted">{bottles.length} bottles · scroll horizontally to see every field</p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Brand</th>
              <th>Distillery</th>
              <th>Category</th>
              <th>Tier</th>
              <th>My tier</th>
              <th>VABC code</th>
              <th>Allocated</th>
              <th>Added to VABC</th>
              <th>First appearance</th>
              <th>MSRP</th>
              <th>Shortcodes</th>
              <th>Warn</th>
              <th>Notes</th>
              <th>Releases</th>
              <th>Listings</th>
              <th>Archived</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {bottles.map((b) => (
              <tr key={b.id} className={b.isArchived ? "archived" : ""}>
                <td className="muted">{b.id}</td>
                <td>
                  <Link href={`/bottles/${b.id}/edit`}>{b.name}</Link>
                </td>
                <td>{b.brand}</td>
                <td>{b.distillery ?? dash}</td>
                <td>{b.category ?? dash}</td>
                <td>
                  {b.tier ? <span className={`tier-chip tier-${b.tier}`}>{b.tier}</span> : dash}
                </td>
                <td>
                  {b.myTier ? (
                    <span className={`tier-chip tier-${b.myTier}`}>{b.myTier}</span>
                  ) : (
                    dash
                  )}
                </td>
                <td className="muted">{b.vabcCode ?? "—"}</td>
                <td>{b.vabcAllocated ? <span className="flag-yes">✓ yes</span> : dash}</td>
                <td>{formatDateValue(b.addedToVabcAt) ?? dash}</td>
                <td>{formatDateValue(b.firstAppearance) ?? dash}</td>
                <td>{b.msrp === null ? dash : `$${Number(b.msrp).toFixed(2)}`}</td>
                <td>
                  {b.aliases.length
                    ? b.aliases.map((a) => (
                        <span key={a.id} className="code-chip">
                          {a.code}
                        </span>
                      ))
                    : dash}
                </td>
                <td className="cell-text">{b.warn ? <span className="warn">{b.warn}</span> : dash}</td>
                <td className="cell-text">{b.notes ?? dash}</td>
                <td className="muted">{b.releases.length}</td>
                <td className="muted">{b.listings.length}</td>
                <td>{b.isArchived ? "yes" : dash}</td>
                <td className="muted">{isoDate(b.createdAt)}</td>
                <td className="muted">{isoDate(b.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
