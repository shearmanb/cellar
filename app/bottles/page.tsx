import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BottlesPage({
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
    include: { aliases: true, releases: true },
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
      <h1>Bottles</h1>
      <div className="toolbar">
        <div className="view-toggle">
          <Link href={`/bottles${suffix}`} className="active">
            Compact
          </Link>
          <Link href={`/bottles/all${suffix}`}>All fields</Link>
        </div>
        <form action="/bottles" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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

      <p className="muted">{bottles.length} bottles</p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Tier</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Shortcodes</th>
            <th>VABC</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bottles.map((b) => (
            <tr key={b.id} className={b.isArchived ? "archived" : ""}>
              <td className="muted">{b.id}</td>
              <td>
                {b.tier ? <span className={`tier-chip tier-${b.tier}`}>{b.tier}</span> : null}
              </td>
              <td>
                <Link href={`/bottles/${b.id}/edit`}>{b.name}</Link>
                {b.vabcAllocated ? (
                  <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.4rem" }}>
                    · allocated
                  </span>
                ) : null}
                {b.warn ? <div className="warn">⚠ {b.warn}</div> : null}
                {b.releases.length > 0 ? (
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {b.releases.length} release{b.releases.length > 1 ? "s" : ""}
                  </div>
                ) : null}
              </td>
              <td>{b.brand}</td>
              <td>
                {b.aliases.map((a) => (
                  <span key={a.id} className="code-chip">
                    {a.code}
                  </span>
                ))}
              </td>
              <td className="muted">{b.vabcCode}</td>
              <td>
                <Link href={`/bottles/${b.id}/edit`} className="muted">
                  edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
