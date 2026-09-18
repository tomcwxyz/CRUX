import Link from "next/link";
import { ClarityWorkbench } from "../components/clarity-workbench";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">0.1 beta pilot</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/test">Technical tests</Link>
          <div className="top-note">Understand one real use of AI without learning the schema first.</div>
        </div>
      </header>

      <section
        className="hero"
        style={{ paddingTop: "clamp(32px, 5vw, 58px)", paddingBottom: 28 }}
      >
        <div>
          <div className="eyebrow">Show your workings</div>
          <h1 style={{ fontSize: "clamp(44px, 6vw, 78px)", maxWidth: 860 }}>Understand one use of AI.</h1>
        </div>
        <p className="hero-copy">
          Start with the work itself. See where AI enters, what it can influence or cause, what evidence supports the account, and what happened in a particular case.
        </p>
      </section>

      <ClarityWorkbench />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Link className="btn" href="/test">Technical/runtime tests</Link>
        <a className="btn" href="/crux-pilot-session.md" download>
          Download learning-session sheet
        </a>
      </div>

      <footer className="footer-note">
        <span>The questions guide the reading. The portable CRUX bundle remains the underlying record.</span>
        <span>Internal, public and affected-person views are projections of the same record.</span>
      </footer>
    </main>
  );
}
