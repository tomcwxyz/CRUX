import Link from "next/link";
import { MentalModelWorkbench } from "../../components/mental-model-workbench";

export default function AuthorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Link className="wordmark" href="/">CRUX</Link>
          <span className="beta">AI use record</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/">All AI uses</Link>
          <Link className="btn ghost" href="/discover">Connect a project instead</Link>
        </div>
      </header>

      <section className="hero" style={{ paddingTop: "clamp(30px, 5vw, 56px)", paddingBottom: 28 }}>
        <div>
          <div className="eyebrow">Add an AI use</div>
          <h1 style={{ fontSize: "clamp(42px, 6vw, 76px)", maxWidth: 860 }}>
            Describe the work. CRUX handles the structure underneath.
          </h1>
        </div>
        <p className="hero-copy">
          Start with where AI appears and what it can actually cause. Add evidence separately from claims,
          and only record a case-level account when the use is consequential.
        </p>
      </section>

      <MentalModelWorkbench />

      <footer className="footer-note">
        <span>A simple assistive use should stay simple. CRUX asks more only when the consequences justify it.</span>
        <Link href="/">Back to AI uses</Link>
      </footer>
    </main>
  );
}
