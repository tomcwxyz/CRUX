import Link from "next/link";
import { BrowserRecordsWorkbench } from "../../components/browser-records-workbench";

export default function RecordsPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Your records</span></div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/author">Add an AI use</Link>
          <Link className="btn ghost" href="/examples">See an example</Link>
        </div>
      </header>
      <BrowserRecordsWorkbench />
    </main>
  );
}
