import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { COLUMNS, COLUMN_COOKIE, parseColumns, type ColumnKey } from "@/lib/columns";

export const dynamic = "force-dynamic";

const TIERS = ["S", "A", "B", "C"];

type Filters = {
  q: string;
  brand: string;
  distillery: string;
  category: string;
  tier: string;
  myTier: string;
  vabc: string;
  ndp: string;
  msrpMin: string;
  msrpMax: string;
  archived: string;
};

export default async function BottlesPage({
  searchParams,
}: {
  searchParams: Promise<Partial<Filters>>;
}) {
  const sp = await searchParams;
  const f: Filters = {
    q: sp.q ?? "",
    brand: sp.brand ?? "",
    distillery: sp.distillery ?? "",
    category: sp.category ?? "",
    tier: sp.tier ?? "",
    myTier: sp.myTier ?? "",
    vabc: sp.vabc ?? "",
    ndp: sp.ndp ?? "",
    msrpMin: sp.msrpMin ?? "",
    msrpMax: sp.msrpMax ?? "",
    archived: sp.archived ?? "",
  };
  const showArchived = f.archived === "1";

  const store = await cookies();
  const enabled = parseColumns(store.get(COLUMN_COOKIE)?.value);
  const visible = COLUMNS.filter((c) => enabled.has(c.key));

  // A filter only applies when its column is visible, so the filter row always
  // matches the displayed fields.
  const shows = (key: ColumnKey) => enabled.has(key);

  const msrpMin = f.msrpMin && !Number.isNaN(Number(f.msrpMin)) ? Number(f.msrpMin) : undefined;
  const msrpMax = f.msrpMax && !Number.isNaN(Number(f.msrpMax)) ? Number(f.msrpMax) : undefined;

  const where: Prisma.BottleWhereInput = {
    ...(showArchived ? {} : { isArchived: false }),
    ...(shows("brand") && f.brand ? { brand: f.brand } : {}),
    ...(shows("distillery") && f.distillery ? { distillery: f.distillery } : {}),
    ...(shows("category") && f.category ? { category: f.category } : {}),
    ...(shows("tier") && f.tier ? { tier: f.tier } : {}),
    ...(shows("myTier") && f.myTier ? { myTier: f.myTier } : {}),
    ...(shows("vabc") && f.vabc ? { vabcCode: { contains: f.vabc, mode: "insensitive" } } : {}),
    ...(shows("ndp") && f.ndp ? { ndp: f.ndp === "yes" } : {}),
    ...(shows("msrp") && (msrpMin !== undefined || msrpMax !== undefined)
      ? { msrp: { ...(msrpMin !== undefined ? { gte: msrpMin } : {}), ...(msrpMax !== undefined ? { lte: msrpMax } : {}) } }
      : {}),
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { brand: { contains: f.q, mode: "insensitive" } },
            { distillery: { contains: f.q, mode: "insensitive" } },
            { aliases: { some: { code: { contains: f.q.toLowerCase() } } } },
          ],
        }
      : {}),
  };

  // Distinct values to populate the brand/distillery/category dropdowns.
  // Scoped to non-archived unless archived are being shown.
  const distinctScope = showArchived ? {} : { isArchived: false };
  const [bottles, brandRows, distilleryRows, categoryRows] = await Promise.all([
    prisma.bottle.findMany({
      where,
      include: { aliases: true, releases: true },
      orderBy: [{ tier: "asc" }, { name: "asc" }],
    }),
    prisma.bottle.findMany({ where: distinctScope, select: { brand: true }, distinct: ["brand"], orderBy: { brand: "asc" } }),
    prisma.bottle.findMany({ where: distinctScope, select: { distillery: true }, distinct: ["distillery"], orderBy: { distillery: "asc" } }),
    prisma.bottle.findMany({ where: distinctScope, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } }),
  ]);

  const brands = brandRows.map((b) => b.brand).filter(Boolean);
  const distilleries = distilleryRows.map((b) => b.distillery).filter((v): v is string => !!v);
  const categories = categoryRows.map((b) => b.category).filter((v): v is string => !!v);

  const optionsFor = (field?: "brand" | "distillery" | "category") =>
    field === "brand" ? brands : field === "distillery" ? distilleries : field === "category" ? categories : [];
  const valueFor = (key: ColumnKey): string =>
    ({ brand: f.brand, distillery: f.distillery, category: f.category, tier: f.tier, myTier: f.myTier, vabc: f.vabc, ndp: f.ndp } as Record<string, string>)[key] ?? "";
  const nameFor = (key: ColumnKey): string =>
    key === "vabc" ? "vabc" : key;

  return (
    <>
      <h1>Bottles</h1>
      <div className="toolbar">
        <form action="/bottles" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <input
            type="search"
            name="q"
            placeholder="Search name, brand, shortcode…"
            defaultValue={f.q}
            style={{ minWidth: "16rem" }}
          />

          {visible.map((c) => {
            if (c.filter === "select") {
              const opts = optionsFor(c.field);
              return (
                <select key={c.key} name={nameFor(c.key)} defaultValue={valueFor(c.key)} aria-label={c.label}>
                  <option value="">All {c.label.toLowerCase()}s</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              );
            }
            if (c.filter === "tier") {
              return (
                <select key={c.key} name={nameFor(c.key)} defaultValue={valueFor(c.key)} aria-label={c.label}>
                  <option value="">All {c.label.toLowerCase()}</option>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              );
            }
            if (c.filter === "text") {
              return (
                <input
                  key={c.key}
                  type="text"
                  name={nameFor(c.key)}
                  placeholder={c.label}
                  defaultValue={valueFor(c.key)}
                  style={{ width: "8rem" }}
                />
              );
            }
            if (c.filter === "bool") {
              return (
                <select key={c.key} name={nameFor(c.key)} defaultValue={valueFor(c.key)} aria-label={c.label}>
                  <option value="">{c.label}: all</option>
                  <option value="yes">{c.label}: yes</option>
                  <option value="no">{c.label}: no</option>
                </select>
              );
            }
            if (c.filter === "range") {
              return (
                <span key={c.key} style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <input type="number" name="msrpMin" placeholder="MSRP min" step="0.01" min="0" defaultValue={f.msrpMin} style={{ width: "7rem" }} />
                  <input type="number" name="msrpMax" placeholder="MSRP max" step="0.01" min="0" defaultValue={f.msrpMax} style={{ width: "7rem" }} />
                </span>
              );
            }
            return null;
          })}

          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} />
            <span className="muted">archived</span>
          </label>
          <button type="submit" className="secondary">
            Filter
          </button>
          <Link href="/bottles" className="btn secondary">
            Clear
          </Link>
        </form>
        <Link href="/bottles/new" className="btn">
          + New bottle
        </Link>
      </div>

      <p className="muted">
        {bottles.length} bottles · <Link href="/control-panel">columns</Link>
      </p>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            {visible.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th>Name</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bottles.map((b) => (
            <tr key={b.id} className={b.isArchived ? "archived" : ""}>
              <td className="muted">{b.id}</td>
              {visible.map((c) => (
                <td key={c.key} className={c.key === "vabc" || c.key === "msrp" ? "muted" : ""}>
                  {renderCell(c.key, b)}
                </td>
              ))}
              <td>
                <Link href={`/bottles/${b.id}/edit`}>{b.name}</Link>
                {b.releases.length > 0 ? (
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {b.releases.length} release{b.releases.length > 1 ? "s" : ""}
                  </div>
                ) : null}
              </td>
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

type BottleRow = Prisma.BottleGetPayload<{ include: { aliases: true; releases: true } }>;

function renderCell(key: ColumnKey, b: BottleRow) {
  switch (key) {
    case "tier":
      return b.tier ? <span className={`tier-chip tier-${b.tier}`}>{b.tier}</span> : null;
    case "myTier":
      return b.myTier ? <span className={`tier-chip tier-${b.myTier}`}>{b.myTier}</span> : null;
    case "brand":
      return b.brand;
    case "distillery":
      return b.distillery;
    case "category":
      return b.category;
    case "shortcodes":
      return b.aliases.map((a) => (
        <span key={a.id} className="code-chip">
          {a.code}
        </span>
      ));
    case "vabc":
      return b.vabcCode;
    case "msrp":
      return b.msrp === null ? null : `$${Number(b.msrp).toFixed(2)}`;
    case "ndp":
      return b.ndp ? "NDP" : null;
    case "warn":
      return b.warn ? <span className="warn">⚠ {b.warn}</span> : null;
    case "notes":
      return b.notes;
    default:
      return null;
  }
}
