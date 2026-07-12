"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  triageAccept,
  triageMatch,
  triageMaybe,
  triageIgnore,
  triageReopen,
  triageUpdate,
  type TriageResult,
} from "@/lib/actions/pending";
import { unlockAdd, type UnlockState } from "@/lib/actions/gate";

export type QueueItem = {
  id: number;
  store: string;
  title: string;
  vendor: string | null;
  price: string | null;
  image: string | null;
  url: string | null;
  category: string | null;
  notes: string | null;
  shortcodes: string | null;
  displayValue: string | null;
  match: { id: number; name: string; brand: string } | null;
};

// Split a queued row's notes into spec lines ("Age: 10 Years", "Mashbill: …")
// for the top-of-card grid, and prose (tasting notes) for the section below.
// Tasting-note labels stay with the prose — they're reading material, not specs.
const SPEC_RE = /^([A-Za-z][A-Za-z0-9'’./ ]{0,28}?)\s*:\s*(.+)$/;
function splitNotes(notes: string | null): { specs: [string, string][]; prose: string } {
  if (!notes) return { specs: [], prose: "" };
  const specs: [string, string][] = [];
  const prose: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(SPEC_RE);
    if (m && !/tasting|nose|palate|finish|taste|note/i.test(m[1])) specs.push([m[1], m[2]]);
    else prose.push(t);
  }
  return { specs, prose: prose.join("\n") };
}

type Toast =
  | { kind: "added"; bottleId: number; label: string }
  | { kind: "removed"; item: QueueItem; label: string }
  | null;

export function QueueTriage({
  items,
  maybe,
  gated,
  unlocked,
}: {
  items: QueueItem[];
  maybe: QueueItem[];
  gated: boolean;
  unlocked: boolean;
}) {
  const [queue, setQueue] = useState<QueueItem[]>(items);
  const [held, setHeld] = useState<QueueItem[]>(maybe);
  const [tab, setTab] = useState<"review" | "maybe">("review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [editing, setEditing] = useState(false);

  const [unlockState, unlockAction, unlockPending] = useActionState<UnlockState, FormData>(
    unlockAdd,
    null
  );
  const [unlockedNow, setUnlockedNow] = useState(unlocked);
  const canWrite = !gated || unlockedNow;
  useEffect(() => {
    if (unlockState && "ok" in unlockState) setUnlockedNow(true);
  }, [unlockState]);

  const current = queue[0] ?? null;

  // Leaving the current card (any action) exits edit mode.
  useEffect(() => {
    setEditing(false);
  }, [current?.id]);

  // Run a triage action, then advance the card stack. On error the card stays
  // put so nothing is silently lost.
  const act = useCallback(
    async (
      item: QueueItem,
      fn: () => Promise<TriageResult>,
      opts: {
        hold?: boolean;
        reopen?: boolean;
        undoable?: boolean;
        from: "review" | "maybe";
      } = { from: "review" }
    ) => {
      setBusy(true);
      setError(null);
      const res = await fn();
      setBusy(false);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      if (opts.from === "review") setQueue((q) => q.filter((x) => x.id !== item.id));
      else setHeld((h) => h.filter((x) => x.id !== item.id));
      if (opts.hold) setHeld((h) => [item, ...h.filter((x) => x.id !== item.id)]);
      if (opts.reopen) setQueue((q) => [item, ...q.filter((x) => x.id !== item.id)]);
      if (res && "bottleId" in res && res.bottleId) {
        setToast({ kind: "added", bottleId: res.bottleId, label: item.title });
      } else if (opts.undoable) {
        setToast({ kind: "removed", item, label: item.title });
      } else {
        setToast(null);
      }
    },
    []
  );

  const yes = useCallback(
    (it: QueueItem) => act(it, () => triageAccept(it.id), { from: "review" }),
    [act]
  );
  const match = useCallback(
    (it: QueueItem) => it.match && act(it, () => triageMatch(it.id, it.match!.id), { from: "review" }),
    [act]
  );
  const later = useCallback(
    (it: QueueItem) => act(it, () => triageMaybe(it.id), { hold: true, from: "review" }),
    [act]
  );
  const no = useCallback(
    (it: QueueItem) => act(it, () => triageIgnore(it.id), { undoable: true, from: "review" }),
    [act]
  );

  // Undo a No: reopen the row and put the card back on top.
  const undo = useCallback(async (item: QueueItem) => {
    setBusy(true);
    const res = await triageReopen(item.id);
    setBusy(false);
    if (res && "error" in res) {
      setError(res.error);
      return;
    }
    setQueue((q) => [item, ...q.filter((x) => x.id !== item.id)]);
    setToast(null);
  }, []);

  // Save from edit mode: persist to the row, then merge into the local card.
  const saveEdit = useCallback(async (item: QueueItem, form: FormData) => {
    setBusy(true);
    setError(null);
    const res = await triageUpdate(item.id, form);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    const merge = (x: QueueItem) => (x.id === item.id ? { ...x, ...res.item } : x);
    setQueue((q) => q.map(merge));
    setHeld((h) => h.map(merge));
    setEditing(false);
  }, []);

  // Keyboard shortcuts on the review tab: y / n / m, e to edit.
  useEffect(() => {
    if (tab !== "review" || !current || editing) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (busy || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "y" && canWrite) yes(current!);
      else if (k === "n") no(current!);
      else if (k === "m") later(current!);
      else if (k === "e") setEditing(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, current, busy, canWrite, editing, yes, no, later]);

  return (
    <div className="triage">
      <div className="triage-head">
        <h1>Queue</h1>
        <div className="triage-tabs">
          <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
            To review ({queue.length})
          </button>
          <button className={tab === "maybe" ? "active" : ""} onClick={() => setTab("maybe")}>
            Maybe ({held.length})
          </button>
        </div>
      </div>

      {gated && !unlockedNow ? (
        <form action={unlockAction} className="card" style={{ marginBottom: "1rem" }}>
          <strong>🔒 Locked</strong>
          <p className="muted" style={{ margin: "0.35rem 0" }}>
            Enter the shared secret to add bottles. You can still say No / Maybe while locked.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="password"
              name="secret"
              placeholder="Shared secret"
              autoComplete="current-password"
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={unlockPending}>
              {unlockPending ? "…" : "Unlock"}
            </button>
          </div>
          {unlockState && "error" in unlockState ? (
            <p className="error" style={{ margin: "0.5rem 0 0" }}>
              {unlockState.error}
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {toast?.kind === "added" ? (
        <div className="triage-toast">
          Added ✓ <a href={`/bottles/${toast.bottleId}/edit`}>{toast.label} — edit</a>
        </div>
      ) : null}
      {toast?.kind === "removed" ? (
        <div className="triage-toast">
          Discarded “{toast.label}”{" "}
          <button
            type="button"
            className="secondary triage-undo"
            onClick={() => undo(toast.item)}
            disabled={busy}
          >
            ↩ Undo
          </button>
        </div>
      ) : null}

      {tab === "review" ? (
        current ? (
          editing ? (
            <EditCard key={current.id} item={current} busy={busy} onSave={saveEdit} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <Card item={current} />
              <div className="triage-actions">
                <div className="triage-toolrow">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditing(true)}
                    disabled={busy}
                  >
                    ✏️ Edit
                  </button>
                  {current.match ? (
                    <button
                      className="match"
                      onClick={() => match(current)}
                      disabled={busy || !canWrite}
                      title="Map to this existing bottle instead of creating a new one"
                    >
                      🔗 It&apos;s #{current.match.id} — {current.match.brand} {current.match.name}
                    </button>
                  ) : null}
                </div>
                <div className="triage-yn">
                  <button className="no" onClick={() => no(current)} disabled={busy}>
                    ❌<br />No
                  </button>
                  <button className="maybe" onClick={() => later(current)} disabled={busy}>
                    🤔<br />Maybe
                  </button>
                  <button className="yes" onClick={() => yes(current)} disabled={busy || !canWrite}>
                    {canWrite ? "✅" : "🔒"}
                    <br />
                    Yes
                  </button>
                </div>
              </div>
            </>
          )
        ) : (
          <p className="triage-empty">Nothing to review 🎉</p>
        )
      ) : held.length ? (
        held.map((it) => (
          <div className="triage-mini" key={it.id}>
            <strong>{it.title}</strong>
            <div className="triage-chips" style={{ marginTop: "0.4rem" }}>
              {it.vendor ? <span className="triage-chip">{it.vendor}</span> : null}
              {it.price ? <span className="triage-chip">${it.price}</span> : null}
              {it.category ? <span className="triage-chip">{it.category}</span> : null}
            </div>
            <div className="triage-mini-actions">
              <button
                onClick={() => act(it, () => triageAccept(it.id), { from: "maybe" })}
                disabled={busy || !canWrite}
              >
                {canWrite ? "✅ Add" : "🔒 Add"}
              </button>
              <button
                className="secondary"
                onClick={() => act(it, () => triageReopen(it.id), { reopen: true, from: "maybe" })}
                disabled={busy}
                title="Back to the review pile (edit it there)"
              >
                ↩ To review
              </button>
              <button
                className="secondary"
                onClick={() => act(it, () => triageIgnore(it.id), { undoable: true, from: "maybe" })}
                disabled={busy}
              >
                ❌ Discard
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="triage-empty">No maybes set aside.</p>
      )}
    </div>
  );
}

function Card({ item }: { item: QueueItem }) {
  const { specs, prose } = splitNotes(item.notes);
  return (
    <div className="triage-card">
      <div className="triage-top">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="triage-thumb" src={item.image} alt="" />
        ) : null}
        <p className="triage-title">{item.title}</p>
      </div>
      <div className="triage-chips">
        {item.vendor ? <span className="triage-chip">{item.vendor}</span> : null}
        {item.price ? <span className="triage-chip">${item.price}</span> : null}
        {item.category ? <span className="triage-chip">{item.category}</span> : null}
        {item.shortcodes ? <span className="triage-chip">codes: {item.shortcodes}</span> : null}
        {item.displayValue ? <span className="triage-chip">DT: {item.displayValue}</span> : null}
        {item.store !== "quickadd" ? <span className="triage-chip">{item.store}</span> : null}
      </div>
      {specs.length > 0 ? (
        <dl className="triage-specs">
          {specs.map(([k, v], i) => (
            <div key={i} className="triage-spec">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {prose ? <div className="triage-notes">{prose}</div> : null}
      {item.url ? (
        <a className="triage-src muted" href={item.url} target="_blank" rel="noreferrer">
          view source ↗
        </a>
      ) : null}
    </div>
  );
}

// Inline edit mode for the current card. Uncontrolled inputs seeded from the
// item; Save persists via triageUpdate, then Yes mints the corrected bottle.
function EditCard({
  item,
  busy,
  onSave,
  onCancel,
}: {
  item: QueueItem;
  busy: boolean;
  onSave: (item: QueueItem, form: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="triage-card triage-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(item, new FormData(e.currentTarget));
      }}
    >
      <div className="field">
        <label htmlFor="t-title">Name *</label>
        <input id="t-title" name="title" type="text" required defaultValue={item.title} />
      </div>
      <div className="triage-edit-row">
        <div className="field">
          <label htmlFor="t-vendor">Brand</label>
          <input id="t-vendor" name="vendor" type="text" defaultValue={item.vendor ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="t-category">Category</label>
          <input id="t-category" name="category" type="text" defaultValue={item.category ?? ""} />
        </div>
      </div>
      <div className="triage-edit-row">
        <div className="field">
          <label htmlFor="t-price">Price ($)</label>
          <input
            id="t-price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item.price ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="t-codes">Shortcodes</label>
          <input id="t-codes" name="shortcodes" type="text" defaultValue={item.shortcodes ?? ""} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="t-display">Drop Tracker display value (blank = not in Drop Tracker)</label>
        <input id="t-display" name="displayValue" type="text" defaultValue={item.displayValue ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="t-notes">Notes</label>
        <textarea id="t-notes" name="notes" rows={6} defaultValue={item.notes ?? ""} />
      </div>
      <div className="triage-edit-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
