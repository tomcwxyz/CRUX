"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  browserRecordLabel, deleteBrowserRecord, readBrowserRecords, reviewSignals, type BrowserRecord,
} from "../lib/browser-records";
import { savePendingBrowserRecord } from "../lib/connection-handoff";
import styles from "./browser-records-workbench.module.css";

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function downloadRecord(record: BrowserRecord) {
  const data = JSON.stringify(record.bundle, null, 2) + "\n";
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "crux-" + record.id.replace(/[^a-z0-9-]/gi, "-") + ".json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BrowserRecordsWorkbench() {
  const router = useRouter();
  const [records, setRecords] = useState<BrowserRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "needs-checking">("all");
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = readBrowserRecords(window.localStorage);
      setRecords(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved records could not be read from this browser.");
    } finally {
      setLoaded(true);
    }
  }, []);

  const sorted = useMemo(() => [...records].sort((a, b) => b.savedAt.localeCompare(a.savedAt)), [records]);
  const visible = sorted.filter((record) =>
    filter === "all" || reviewSignals(record.bundle).actions.length > 0,
  );

  const open = (record: BrowserRecord) => {
    try {
      savePendingBrowserRecord(record.id, record.bundle);
      router.push("/author");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this record.");
    }
  };

  const remove = (id: string) => {
    try {
      deleteBrowserRecord(window.localStorage, id);
      setRecords(readBrowserRecords(window.localStorage));
      setRemoving(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this record.");
    }
  };

  return (
    <section className={styles.workspace} aria-label="Your saved AI uses">
      <header className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>Your working records</span>
          <h1>Pick up where you left off.</h1>
          <p>Review what you've described, check gaps and add new evidence when something changes.</p>
        </div>
        <Link className="btn primary" href="/author">+ Describe an AI use</Link>
      </header>
      <p className={styles.storageNote}>
        <strong>Saved only in this browser.</strong> CRUX has no account or cloud library here.
        Records are saved only when you choose to save them. They can contain sensitive details,
        so avoid saving on a shared device. Download a JSON backup before clearing browser data.
      </p>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {!loaded ? <p className={styles.muted}>Checking this browser for saved records…</p> : records.length === 0 ? (
        <div className={styles.empty}>
          <h2>No saved AI uses here yet.</h2>
          <p>Start with one real example. Once you've described it, use <strong>Save in this browser</strong> to bring it back here.</p>
          <p>Already have a portable CRUX record? You can open its JSON file in the editor.</p>
          <Link className="btn primary" href="/author">Start describing →</Link>
        </div>
      ) : (
        <>
          <div className={styles.listHead}>
            <div><h2>{records.length} saved {records.length === 1 ? "record" : "records"}</h2>
              <p>Sorted by when you last saved them. This is not a live health or compliance check.</p></div>
            <div className={styles.filters} role="group" aria-label="Filter saved records">
              <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
              <button type="button" aria-pressed={filter === "needs-checking"} onClick={() => setFilter("needs-checking")}>Needs checking</button>
            </div>
          </div>
          {visible.length ? <div className={styles.list}>
            {visible.map((record) => {
              const summary = reviewSignals(record.bundle);
              return (
                <article key={record.id} className={styles.record}>
                  <div className={styles.recordHead}>
                    <div>
                      <span className={styles.saved}>Saved {dateLabel(record.savedAt)} · {record.bundle.organisations[0]?.name ?? "Organisation not named"}</span>
                      <h3>{browserRecordLabel(record)}</h3>
                    </div>
                    <span className={summary.differences ? styles.difference : styles.attention}>{summary.title}</span>
                  </div>
                  <p className={styles.description}>{record.bundle.ai_uses[0]?.public_summary || record.bundle.ai_uses[0]?.purpose || "No description recorded yet."}</p>
                  {summary.actions.length ? (
                    <div className={styles.checks}>
                      <strong>What needs checking?</strong>
                      <ul>{summary.actions.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                      {summary.actions.length > 3 ? <span>More questions inside the record</span> : null}
                    </div>
                  ) : <p className={styles.quiet}>No gaps flagged in the saved record. This does not mean the live system has been checked.</p>}
                  <p className={styles.runtimeNote}>
                    {summary.observations === 0
                      ? "No runtime observations are linked in this saved record. That is not evidence the system has never run."
                      : "This saved record includes runtime observations. They are not refreshed automatically."}
                  </p>
                  {record.changesSinceLastSave.length > 0 ? (
                    <details className={styles.changes}>
                      <summary>What changed in this record at the last save?</summary>
                      <ul>{record.changesSinceLastSave.map((change) => <li key={change}>{change}</li>)}</ul>
                    </details>
                  ) : null}
                  <div className={styles.actions}>
                    <button className="btn primary" type="button" onClick={() => open(record)}>Open and review →</button>
                    <button className="btn ghost" type="button" onClick={() => downloadRecord(record)}>Download JSON</button>
                    <button className="btn ghost" type="button" onClick={() => setRemoving(record.id)}>Remove from browser</button>
                  </div>
                  {removing === record.id ? <div className={styles.removeConfirm}>
                    <p>Remove this browser copy? This cannot be undone here. Download a backup first if you need one.</p>
                    <button className="btn" type="button" onClick={() => remove(record.id)}>Yes, remove</button>
                    <button className="btn ghost" type="button" onClick={() => setRemoving(null)}>Cancel</button>
                  </div> : null}
                </article>
              );
            })}
          </div> : <div className={styles.empty}><h2>Nothing in this filter.</h2><p>No saved records currently have those review prompts.</p>
            <button className="btn" type="button" onClick={() => setFilter("all")}>Show all records</button></div>}
          <p className={styles.bottomNote}>CRUX does not automatically re-scan these records. To spot changes in a real system, add a new observation, inspect the project again or update the record.</p>
        </>
      )}
    </section>
  );
}
