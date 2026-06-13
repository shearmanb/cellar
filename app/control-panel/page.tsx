import { cookies } from "next/headers";
import Link from "next/link";
import { COLUMNS, COLUMN_COOKIE, parseColumns, DEFAULT_COLUMNS } from "@/lib/columns";
import { saveColumns } from "@/lib/actions/prefs";

export const dynamic = "force-dynamic";

export default async function ControlPanelPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const store = await cookies();
  const enabled = parseColumns(store.get(COLUMN_COOKIE)?.value);

  return (
    <>
      <h1>Control panel</h1>
      <p className="muted">
        Choose which fields show as columns on the{" "}
        <Link href="/bottles">bottle list</Link>. Every column you enable also gets its own
        filter there. Defaults: {DEFAULT_COLUMNS.join(", ")}.
      </p>

      {saved ? <p className="success">Saved — your bottle list is updated.</p> : null}

      <form action={saveColumns} className="card" style={{ maxWidth: "640px" }}>
        <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.25rem" }}>Display columns</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ID and Name are always shown.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem 1.5rem",
            margin: "1rem 0",
          }}
        >
          {COLUMNS.map((c) => (
            <label
              key={c.key}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input type="checkbox" name={`col_${c.key}`} defaultChecked={enabled.has(c.key)} />
              <span>{c.label}</span>
              {c.filter ? <span className="muted" style={{ fontSize: "0.75rem" }}>filterable</span> : null}
            </label>
          ))}
        </div>
        <div className="actions">
          <button type="submit">Save display settings</button>
          <Link href="/bottles" className="btn secondary">
            View bottle list
          </Link>
        </div>
      </form>
    </>
  );
}
