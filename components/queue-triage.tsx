"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  triageAccept,
  triageMatch,
  triageMaybe,
  triageIgnore,
  triageReopen,
  type TriageResult,
} from "@/lib/actions/pending";
import { unlockAdd, type UnlockState } from "@/lib/actions/gate";

export type QueueItem = {
  id: number;
  title: string;
  vendor: string | null;
  price: string | null;
  image: string | null;
  url: string | null;
  category: string | null;
  notes: string | null;
  shortcodes: string | null;
  match: { id: number; name: string; brand: string } | null;
};

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
  const [toast, setToast] = useState<{ bottleId?: number; label: string } | null>(null);

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

  // Run a triage action, then advance the card stack. On error the card stays
  // put so nothing is silently lost.
  const act = useCallback(
    async (
      item: QueueItem,
      fn: () => Promise<TriageResult>,
      opts: { hold?: boolean; reopen?: boolean; from: "review" | "maybe" } = { from: "review" }
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
        setToast({ bottleId: res.bottleId, label: item.title });
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
    (it: QueueItem) => act(it, () => triageIgnore(it.id), { from: "review" }),
    [act]
  );

  // Keyboard shortcuts on the review tab: y / n / m.
  useEffect(() => {
    if (tab !== "review" || !current) return;
    function onKey(e: KeyboardEvent) {
      if (busy || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === "y" && canWrite) yes(current!);
      else if (k === "n") no(current!);
      else if (k === "m") later(current!);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, current, busy, canWrite, yes, no, later]);

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
      {toast ? (
        <div className="triage-toast">
          Added ✓{" "}
          <a href={`/bottles/${toast.bottleId}/edit`}>
            {toast.label} — edit
          </a>
        </div>
      ) : null}

      {tab === "review" ? (
        current ? (
          <>
            <Card item={current} />
            <div className="triage-actions">
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
              >
                ↩ To review
              </button>
              <button
                className="secondary"
                onClick={() => act(it, () => triageIgnore(it.id), { from: "maybe" })}
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
  return (
    <div className="triage-card">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt="" />
      ) : null}
      <p className="triage-title">{item.title}</p>
      <div className="triage-chips">
        {item.vendor ? <span className="triage-chip">{item.vendor}</span> : null}
        {item.price ? <span className="triage-chip">${item.price}</span> : null}
        {item.category ? <span className="triage-chip">{item.category}</span> : null}
        {item.shortcodes ? <span className="triage-chip">codes: {item.shortcodes}</span> : null}
      </div>
      {item.notes ? <div className="triage-notes">{item.notes}</div> : null}
      {item.url ? (
        <a className="triage-src muted" href={item.url} target="_blank" rel="noreferrer">
          view source ↗
        </a>
      ) : null}
    </div>
  );
}
