import Link from "next/link";
import { ClarityWorkbench } from "../../components/clarity-workbench";

export default function AuthorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">authoring</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/">Back to audience views</Link>
          <div className="top-note">Describe the use internally; CRUX derives safer audience views from the record.</div>
        </div>
      </header>

      <section className="hero" style={{ paddingTop: "clamp(30px, 5vw, 56px)", paddingBottom: 28 }}>
        <div>
          <div className="eyebrow">Internal authoring</div>
          <h1 style={{ fontSize: "clamp(42px, 6vw, 76px)", maxWidth: 860 }}>Describe one real use of AI.</h1>
        </div>
        <p className="hero-copy">
          Start with the work, authority and evidence. Public and affected-person views are separate reading experiences, not extra forms to fill in.
        </p>
      </section>

      <ClarityWorkbench />

      <footer className="footer-note">
        <span>Authoring is an internal job. Audience-facing views should remain simpler and purpose-specific.</span>
        <Link href="/">See the audience views</Link>
      </footer>
    </main>
  );
}
