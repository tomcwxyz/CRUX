import { PilotWorkbench } from "../components/pilot-workbench";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">0.1 beta pilot</span>
        </div>
        <div className="top-note">Open evidence and provenance for organisational AI.</div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Show your workings</div>
          <h1>See where AI matters.</h1>
        </div>
        <p className="hero-copy">
          Document how AI is used, what it can influence, what evidence exists, and what actually happened — without reducing trust to a score.
        </p>
      </section>

      <PilotWorkbench />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <a className="btn" href="/crux-pilot-session.md" download>
          Download pilot session sheet
        </a>
      </div>

      <footer className="footer-note">
        <span>CRUX keeps the portable bundle as the source of truth.</span>
        <span>No account · no database · no hidden app-only state.</span>
      </footer>
    </main>
  );
}
