"use client";

import { useState } from "react";
import { importCsv, type ImportResult } from "@/lib/actions/import";
import { CSV_HEADER } from "@/lib/csv";

export default function ImportPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setText(await file.text());
  }

  async function run() {
    setBusy(true);
    try {
      setResult(await importCsv(text));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Import CSV</h1>
      <p className="muted">
        Bulk create/update bottles. Rows with an <code>id</code> update that bottle in place
        (use <a href="/api/export">Export CSV</a> for a round-trippable starting point);
        rows without an id create new bottles. <code>shortcodes</code> is
        semicolon-separated and replaces the bottle&apos;s existing codes.
      </p>
      <p className="muted">
        Columns: <code>{CSV_HEADER.join(", ")}</code> (only <code>name</code> and{" "}
        <code>brand</code> are required)
      </p>

      <div className="card">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <textarea
          rows={14}
          style={{ width: "100%", marginTop: "0.75rem", fontFamily: "monospace" }}
          placeholder={`${CSV_HEADER.join(",")}\n,Eagle Rare 10yr Bourbon,Buffalo Trace,Buffalo Trace,Bourbon,A,,,,"",,"ER;ER10;eaglerare"`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="actions">
          <button onClick={run} disabled={busy || text.trim() === ""}>
            {busy ? "Importing…" : "Import"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="card">
          <p>
            <span className="success">
              {result.created} created, {result.updated} updated.
            </span>{" "}
            {result.errors.length > 0 ? (
              <span className="error">{result.errors.length} row(s) failed:</span>
            ) : null}
          </p>
          {result.errors.length > 0 ? (
            <ul className="error">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
