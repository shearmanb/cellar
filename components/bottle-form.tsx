"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/bottles";
import { brandKey } from "@/lib/brand-rules";

export type BrandRuleHint = {
  brandKey: string;
  distillery: string | null;
  category: string | null;
  ndp: boolean | null;
};

export type BottleFormValues = {
  name?: string;
  brand?: string;
  distillery?: string | null;
  category?: string | null;
  tier?: string | null;
  myTier?: string | null;
  vabcCode?: string | null;
  ndp?: boolean | null;
  vabcAllocated?: boolean;
  addedToVabcAt?: string | null;
  firstAppearance?: string | null;
  msrp?: string | null;
  warn?: string | null;
  notes?: string | null;
  displayValue?: string | null;
  shortcodes?: string;
};

const TIERS = ["", "S", "A", "B", "C"];

export function BottleForm({
  action,
  initial = {},
  submitLabel,
  rules = [],
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial?: BottleFormValues;
  submitLabel: string;
  rules?: BrandRuleHint[];
}) {
  const [state, formAction, pending] = useActionState(action, null);

  // When the brand matches a rule, seed blank distillery/category and the NDP
  // checkbox from it. Values stay editable — this is a default, not a lock.
  function applyRuleForBrand(brand: string) {
    const rule = rules.find((r) => r.brandKey === brandKey(brand));
    if (!rule) return;
    const dist = document.getElementById("distillery") as HTMLInputElement | null;
    const cat = document.getElementById("category") as HTMLInputElement | null;
    const ndp = document.getElementById("ndp") as HTMLInputElement | null;
    if (rule.distillery && dist && !dist.value) dist.value = rule.distillery;
    if (rule.category && cat && !cat.value) cat.value = rule.category;
    if (rule.ndp != null && ndp) ndp.checked = rule.ndp;
  }

  return (
    <form action={formAction} className="form-grid">
      {state?.error ? <p className="error full">{state.error}</p> : null}

      <div className="field full">
        <label htmlFor="name">Name *</label>
        <input id="name" name="name" type="text" required defaultValue={initial.name ?? ""} placeholder="George T. Stagg Bourbon" />
      </div>
      <div className="field full">
        <label htmlFor="displayValue">Drop Tracker display value</label>
        <input id="displayValue" name="displayValue" type="text" defaultValue={initial.displayValue ?? ""} placeholder="Label shown in Drop Tracker — blank keeps this bottle out of Drop Tracker" />
      </div>
      <div className="field">
        <label htmlFor="brand">Brand *</label>
        <input
          id="brand"
          name="brand"
          type="text"
          required
          defaultValue={initial.brand ?? ""}
          placeholder="Buffalo Trace"
          onBlur={(e) => applyRuleForBrand(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="distillery">Distillery</label>
        <input id="distillery" name="distillery" type="text" defaultValue={initial.distillery ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="category">Category</label>
        <input id="category" name="category" type="text" defaultValue={initial.category ?? ""} placeholder="Bourbon, Rye…" list="categories" />
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
        <label htmlFor="tier">Tier</label>
        <select id="tier" name="tier" defaultValue={initial.tier ?? ""}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t === "" ? "—" : t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="myTier">My tier (override)</label>
        <select id="myTier" name="myTier" defaultValue={initial.myTier ?? ""}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t === "" ? "—" : t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="vabcCode">VA ABC code</label>
        <input id="vabcCode" name="vabcCode" type="text" defaultValue={initial.vabcCode ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="vabcAllocated">VA ABC allocated</label>
        <label className="checkbox-row">
          <input
            id="vabcAllocated"
            name="vabcAllocated"
            type="checkbox"
            defaultChecked={initial.vabcAllocated ?? false}
          />
          Allocated / lottery product
        </label>
      </div>
      <div className="field">
        <label htmlFor="addedToVabcAt">Added to VABC website</label>
        <input
          id="addedToVabcAt"
          name="addedToVabcAt"
          type="date"
          defaultValue={initial.addedToVabcAt ?? ""}
        />
      </div>
      <div className="field">
        <label htmlFor="firstAppearance">First appearance</label>
        <input
          id="firstAppearance"
          name="firstAppearance"
          type="date"
          defaultValue={initial.firstAppearance ?? ""}
        />
      </div>
      <div className="field">
        <label htmlFor="msrp">MSRP ($)</label>
        <input id="msrp" name="msrp" type="number" step="0.01" min="0" defaultValue={initial.msrp ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="ndp">Non-distiller producer</label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", textTransform: "none" }}>
          <input id="ndp" name="ndp" type="checkbox" defaultChecked={initial.ndp ?? false} style={{ width: "auto" }} />
          <span className="muted">Sourced, not self-distilled (NDP)</span>
        </label>
      </div>
      <div className="field full">
        <label htmlFor="shortcodes">Shortcodes (comma or newline separated)</label>
        <textarea id="shortcodes" name="shortcodes" rows={2} defaultValue={initial.shortcodes ?? ""} placeholder="EHT, EHTsm, EHTsmall, EH" />
      </div>
      <div className="field full">
        <label htmlFor="warn">Collision warning</label>
        <input id="warn" name="warn" type="text" defaultValue={initial.warn ?? ""} placeholder='e.g. "Use OFitz1924, not OF1924 — collides with Old Forester"' />
      </div>
      <div className="field full">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} />
      </div>

      <div className="actions full">
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <a href="/bottles" className="btn secondary">
          Cancel
        </a>
      </div>
    </form>
  );
}
