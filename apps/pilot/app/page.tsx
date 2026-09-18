import Link from "next/link";
import { LearningCasePicker } from "../components/learning-case-picker";
import { MentalModelWorkbench } from "../components/mental-model-workbench";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">0.1 beta pilot</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/test">Run a technical test</Link>
          <div className="top-note">A guided way to think clearly about AI in an organisation.</div>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">Show your workings</div>
          <h1>Think clearly about where AI matters.</h1>
        </div>
        <p className="hero-copy">
          See where AI enters real work, what power it has, why someone should believe what is said about it, and what happened in consequential cases.
        </p>
      </section>

      <LearningCasePicker />
      <MentalModelWorkbench />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Link className="btn" href="/test">Technical/runtime tests</Link>
        <a className="btn" href="/crux-pilot-session.md" download>
          Download learning-session sheet
        </a>
      </div>

      <footer className="footer-note">
        <span>The questions are the product. The portable CRUX bundle is the output.</span>
        <span>No account or hosted database is required to author a record.</span>
      </footer>
    </main>
  );
}
