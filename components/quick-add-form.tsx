"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { quickAddBottle, type QuickAddState } from "@/lib/actions/bottles";
import {
  parsePaste,
  parseBookmarkletPayload,
  emptyParsed,
  type ParsedBottle,
} from "@/lib/parse";
import { brandKey } from "@/lib/brand-rules";
import { nameSimilarity } from "@/lib/dupes";
import type { BrandRuleHint } from "@/components/bottle-form";

type BottleLite = { id: number; name: string; brand: string };

// Advisory "did you mean this existing bottle?" — looser than the /dupes
// threshold on purpose; a same-brand match gets a nudge.
function similarBottles(name: string, brand: string, bottles: BottleLite[]) {
  const n = name.trim();
  if (n.length < 3) return [];
  const bk = brand.trim() ? brandKey(brand) : "";
  return bottles
    .map((b) => {
      let score = nameSimilarity(n, b.name);
      if (bk && bk === brandKey(b.brand)) score += 0.15;
      return { bottle: b, score };
    })
    .filter((x) => x.score >= 0.55)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export function QuickAddForm({
  brands,
  rules,
  bottles,
}: {
  brands: string[];
  rules: BrandRuleHint[];
  bottles: BottleLite[];
}) {
  const [f, setF] = useState<ParsedBottle>(emptyParsed());
  const [raw, setRaw] = useState("");
  const [state, formAction, isPending] = useActionState<QuickAddState, FormData>(
    quickAddBottle,
    null
  );
  const initialized = useRef(false);

  // Bookmarklet hand-off: the page was opened as /add#p=<payload>. Decode it,
  // prefill, then strip the hash so a reload doesn't re-add the same bottle.
  useEffect(() => {
    if (initialized.current || typeof window === "undefined") return;
    initialized.current = true;
    const hash = window.location.hash;
    if (hash.startsWith("#p=")) {
      try {
        setF(parseBookmarkletPayload(decodeURIComponent(hash.slice(3)), brands));
      } catch {
        /* malformed payload — leave the form empty for manual paste */
      }
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [brands]);

  // Clear the form after a successful add so the next paste starts clean.
  useEffect(() => {
    if (state && "ok" in state) {
      setF(emptyParsed());
      setRaw("");
    }
  }, [state]);

  const dupes = useMemo(() => similarBottles(f.name, f.brand, bottles), [f.name, f.brand, bottles]);

  function set<K extends keyof ParsedBottle>(key: K, value: ParsedBottle[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function doParse() {
    setF(parsePaste(raw, brands));
  }

  // Mirror BottleForm: a known brand seeds blank distillery/category.
  function applyRuleForBrand(brand: string) {
    const rule = rules.find((r) => r.brandKey === brandKey(brand));
    if (!rule) return;
    setF((prev) => ({
      ...prev,
      distillery: prev.distillery || rule.distillery || "",
      category: prev.category || rule.category || "",
    }));
  }

  return (
    <div>
      <div className="field full" style={{ maxWidth: 720, marginBottom: "1rem" }}>
        <label htmlFor="paste">Paste a product title, listing, notes, or JSON</label>
        <textarea
          id="paste"
          rows={4}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter parses without reaching for the mouse.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              doParse();
            }
          }}
          placeholder={
            "e.g.  Buffalo Trace Kosher Wheat Recipe Straight Bourbon 750ml — $89.99\n\nor a whole listing, tasting notes, or pasted JSON-LD"
          }
          style={{ width: "100%" }}
        />
        <div className="actions" style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={doParse} disabled={!raw.trim()}>
            Parse ↓
          </button>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            Or use the{" "}
            <a href="/bookmarklet">bookmarklet</a> to send the page you&apos;re on here
            automatically.
          </span>
        </div>
      </div>

      {state && "error" in state ? <p className="error">{state.error}</p> : null}
      {state && "ok" in state ? (
        <p className="success">
          Added <a href={`/bottles/${state.id}/edit`}>#{state.id} {state.name}</a> ✓ — paste
          the next one, or open it to add tier / codes / more.
        </p>
      ) : null}

      <form action={formAction} className="form-grid">
        <div className="field full">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="George T. Stagg Bourbon"
          />
          {dupes.length > 0 ? (
            <p className="warn" style={{ marginTop: "0.35rem" }}>
              Possible existing match:{" "}
              {dupes.map((d, i) => (
                <span key={d.bottle.id}>
                  {i > 0 ? ", " : ""}
                  <a href={`/bottles/${d.bottle.id}/edit`} target="_blank" rel="noreferrer">
                    #{d.bottle.id} {d.bottle.brand} {d.bottle.name}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="brand">Brand *</label>
          <input
            id="brand"
            name="brand"
            type="text"
            required
            list="known-brands"
            value={f.brand}
            onChange={(e) => set("brand", e.target.value)}
            onBlur={(e) => applyRuleForBrand(e.target.value)}
            placeholder="Buffalo Trace"
          />
          <datalist id="known-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="distillery">Distillery</label>
          <input
            id="distillery"
            name="distillery"
            type="text"
            value={f.distillery}
            onChange={(e) => set("distillery", e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <input
            id="category"
            name="category"
            type="text"
            list="categories"
            value={f.category}
            onChange={(e) => set("category", e.target.value)}
            placeholder="Bourbon, Rye…"
          />
          <datalist id="categories">
            <option value="Bourbon" />
            <option value="Rye" />
            <option value="American Whiskey" />
            <option value="Scotch" />
            <option value="Irish" />
            <option value="Japanese" />
            <option value="Tequila" />
            <option value="Other" />
          </datalist>
        </div>

        <div className="field">
          <label htmlFor="msrp">MSRP ($)</label>
          <input
            id="msrp"
            name="msrp"
            type="number"
            step="0.01"
            min="0"
            value={f.msrp}
            onChange={(e) => set("msrp", e.target.value)}
          />
        </div>

        <div className="field full">
          <label htmlFor="shortcodes">Shortcodes (comma or newline separated)</label>
          <textarea
            id="shortcodes"
            name="shortcodes"
            rows={2}
            value={f.shortcodes}
            onChange={(e) => set("shortcodes", e.target.value)}
            placeholder="EHT, EHTsm, EHTsmall"
          />
        </div>

        <div className="field full">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        {/* Provenance — folded into notes on save (Bottle has no url column). */}
        <input type="hidden" name="sourceUrl" value={f.url} />

        {f.url || f.image ? (
          <div className="field full">
            <label>Source</label>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {f.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.image} alt="" width={56} style={{ borderRadius: 6 }} />
              ) : null}
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="muted">
                  {f.url}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="actions full">
          <button type="submit" disabled={isPending || !f.name.trim() || !f.brand.trim()}>
            {isPending ? "Adding…" : "Add to Cellar"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setF(emptyParsed());
              setRaw("");
            }}
          >
            Clear
          </button>
          {f.source ? (
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              parsed from {f.source}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
