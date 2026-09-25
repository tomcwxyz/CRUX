import Link from "next/link";
import { HomeReader } from "../components/home-reader";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">0.1 beta pilot</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/discover">Discover AI</Link>
          <Link className="btn ghost" href="/live">Live runtime</Link>
          <Link className="btn ghost" href="/test">Technical tests</Link>
          <div className="top-note">One record. Different questions for different people.</div>
        </div>
      </header>

      <section
        className="hero"
        style={{ paddingTop: "clamp(32px, 5vw, 58px)", paddingBottom: 28 }}
      >
        <div>
          <div className="eyebrow">Show your workings</div>
          <h1 style={{ fontSize: "clamp(44px, 6vw, 78px)", maxWidth: 880 }}>Make AI understandable to the person who needs to understand it.</h1>
        </div>
        <p className="hero-copy">
          Internal teams need to scrutinise the system. The public needs a clear explanation. A person affected by a decision needs to understand what happened in their case.
        </p>
      </section>

      <HomeReader />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Link className="btn primary" href="/discover">Start with discovery</Link>
        <Link className="btn" href="/live">Try the live runtime slice</Link>
        <Link className="btn" href="/author">Create or edit a record</Link>
        <a className="btn" href="/crux-pilot-session.md" download>
          Download learning-session sheet
        </a>
      </div>

      <footer className="footer-note">
        <span>The same CRUX record can support different explanations without exposing the same information to everyone.</span>
        <span>Public and affected-person views are generated from disclosure-safe projections.</span>
      </footer>
    </main>
  );
}
