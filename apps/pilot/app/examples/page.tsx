import Link from "next/link";
import { HomeReader } from "../../components/home-reader";

export default function ExamplesPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Link className="wordmark" href="/">CRUX</Link>
          <span className="beta">worked examples</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/">All AI uses</Link>
          <Link className="btn primary" href="/author">+ Add an AI use</Link>
        </div>
      </header>
      <section className="hero" style={{ paddingTop: "clamp(30px, 5vw, 56px)", paddingBottom: 28 }}>
        <div>
          <div className="eyebrow">Explore a CRUX record</div>
          <h1 style={{ fontSize: "clamp(42px, 6vw, 76px)", maxWidth: 860 }}>See how AI use reads to different people.</h1>
        </div>
        <p className="hero-copy">
          Compare a writing assistant, funding review and bounded action. Switch between internal, public
          and affected-person explanations, or open a portable CRUX record of your own.
        </p>
      </section>
      <HomeReader />
      <footer className="footer-note">
        <span>These are learning examples, not records from your organisation. Lower-disclosure views use explicit safe projections.</span>
        <Link href="/author">Describe an AI use yourself</Link>
      </footer>
    </main>
  );
}
