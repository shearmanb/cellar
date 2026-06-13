import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { COLUMNS, COLUMN_COOKIE, parseColumns, DEFAULT_COLUMNS } from "@/lib/columns";
import { saveColumns } from "@/lib/actions/prefs";
import { saveBrandRule, deleteBrandRule, backfillBrandRules } from "@/lib/actions/brand-rules";

export const dynamic = "force-dynamic";

type Params = {
  saved?: string;
  ruleSaved?: string;
  ruleDeleted?: string;
  ruleError?: string;
  backfilled?: string;
};

function ndpRuleValue(ndp: boolean | null): string {
  return ndp === true ? "yes" : ndp === false ? "no" : "";
}

export default async function ControlPanelPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { saved, ruleSaved, ruleDeleted, ruleError, backfilled } = await searchParams;
  const store = await cookies();
  const enabled = parseColumns(store.get(COLUMN_COOKIE)?.value);
  const rules = await prisma.brandRule.findMany({ orderBy: { brand: "asc" } });

  return (
    <>
      <h1>Control panel</h1>

      {/* ---------- Display columns ---------- */}
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

      {/* ---------- Brand rules ---------- */}
      <h2 style={{ fontSize: "1.2rem", marginTop: "2rem" }}>Brand rules</h2>
      <p className="muted">
        Set defaults by brand. When a bottle&apos;s brand matches (case-insensitive), these
        values fill any <em>blank</em> distillery/category, and apply the NDP flag, on import and
        new-bottle entry. They are defaults — you can still override them on an individual bottle.
      </p>

      {ruleSaved ? <p className="success">Brand rule saved.</p> : null}
      {ruleDeleted ? <p className="success">Brand rule deleted.</p> : null}
      {ruleError ? <p className="error">{ruleError}</p> : null}
      {backfilled !== undefined ? (
        <p className="success">Backfill complete — {backfilled} bottle(s) updated.</p>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th>Distillery</th>
              <th>Category</th>
              <th>NDP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No brand rules yet — add one below.
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td colSpan={4} style={{ paddingRight: 0 }}>
                    <form
                      action={saveBrandRule}
                      style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <input type="text" name="brand" defaultValue={r.brand} style={{ width: "11rem" }} />
                      <input type="text" name="distillery" defaultValue={r.distillery ?? ""} placeholder="distillery" style={{ width: "11rem" }} />
                      <input type="text" name="category" defaultValue={r.category ?? ""} placeholder="category" style={{ width: "8rem" }} />
                      <select name="ndp" defaultValue={ndpRuleValue(r.ndp)}>
                        <option value="">NDP: —</option>
                        <option value="yes">NDP: yes</option>
                        <option value="no">NDP: no</option>
                      </select>
                      <button type="submit" className="secondary">
                        Save
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={deleteBrandRule.bind(null, r.id)}>
                      <button type="submit" className="secondary">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <form
          action={saveBrandRule}
          className="toolbar"
          style={{ marginTop: "1rem", alignItems: "center" }}
        >
          <input type="text" name="brand" placeholder="Brand (e.g. Smoke Wagon)" required style={{ width: "12rem" }} />
          <input type="text" name="distillery" placeholder="Distillery (optional)" style={{ width: "12rem" }} />
          <input type="text" name="category" placeholder="Category (optional)" style={{ width: "9rem" }} />
          <select name="ndp" defaultValue="">
            <option value="">NDP: —</option>
            <option value="yes">NDP: yes</option>
            <option value="no">NDP: no</option>
          </select>
          <button type="submit">+ Add rule</button>
        </form>
      </div>

      <form action={backfillBrandRules} className="actions">
        <button type="submit" className="secondary">
          Apply rules to existing bottles
        </button>
        <span className="muted">
          Fills blank distillery/category and sets NDP on all matching bottles now.
        </span>
      </form>
    </>
  );
}
