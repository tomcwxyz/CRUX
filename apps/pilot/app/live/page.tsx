import Link from "next/link";
import { LiveRuntimeWorkbench } from "../../components/live-runtime-workbench";

export default function LiveRuntimePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">live runtime slice</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/">Audience views</Link>
          <Link className="btn ghost" href="/author">Authoring</Link>
          <div className="top-note">Humans declare meaning. Systems report behaviour. CRUX reconciles the two.</div>
        </div>
      </header>

      <section
        className="hero"
        style={{ paddingTop: "clamp(32px, 5vw, 58px)", paddingBottom: 28 }}
      >
        <div>
          <div className="eyebrow">Living account</div>
          <h1 style={{ fontSize: "clamp(44px, 6vw, 78px)", maxWidth: 900 }}>
            Confront the description with what actually ran.
          </h1>
        </div>
        <p className="hero-copy">
          This synthetic Funding Review pilot uses the real CRUX runtime path: metadata-only instrumentation, durable Neon ingestion, declared-versus-observed reconciliation, then human review before a case can appear to an affected person.
        </p>
      </section>

      <LiveRuntimeWorkbench />

      <footer className="footer-note">
        <span>No real applicant information is used in this pilot. The live provider check uses synthetic text only.</span>
        <span>Runtime observations remain internal until a person explicitly confirms the meaning of a case.</span>
      </footer>
    </main>
  );
}
