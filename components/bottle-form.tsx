"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/bottles";

export type BottleFormValues = {
  name?: string;
  brand?: string;
  distillery?: string | null;
  category?: string | null;
  tier?: string | null;
  myTier?: string | null;
  vabcCode?: string | null;
  vabcAllocated?: boolean;
  addedToVabcAt?: string | null;
  firstAppearance?: string | null;
  msrp?: string | null;
  warn?: string | null;
  notes?: string | null;
  shortcodes?: string;
};

const TIERS = ["", "S", "A", "B", "C"];

export function BottleForm({
  action,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial?: BottleFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="form-grid">
      {state?.error ? <p className="error full">{state.error}</p> : null}

      <div className="field full">
        <label htmlFor="name">Name *</label>
        <input id="name" name="name" type="text" required defaultValue={initial.name ?? ""} placeholder="George T. Stagg Bourbon" />
      </div>
      <div className="field">
        <label htmlFor="brand">Brand *</label>
        <input id="brand" name="brand" type="text" required defaultValue={initial.brand ?? ""} placeholder="Buffalo Trace" />
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
