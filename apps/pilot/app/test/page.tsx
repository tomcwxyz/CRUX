import Link from "next/link";
import { RuntimeTestPanel } from "../../components/runtime-test-panel";
import { TransportTestPanel } from "../../components/transport-test-panel";

export default function RuntimeTestPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">runtime test</span>
        </div>
        <Link className="btn ghost" href="/">Back to pilot</Link>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Test the boundary</div>
          <h1>What did CRUX actually see?</h1>
        </div>
        <p className="hero-copy">
          Run a safe demo or a real model call in the browser, follow an AI-mediated workflow, then test how bounded observations cross the CRUX transport boundary.
        </p>
      </section>

      <section className="workbench">
        <div className="panel">
          <RuntimeTestPanel />
          <TransportTestPanel />
        </div>
      </section>

      <footer className="footer-note">
        <span>Metadata first. Content remains outside CRUX by default.</span>
        <span>Browser tests · no local CLI required.</span>
      </footer>
    </main>
  );
}
