import Link from "next/link";
import { SimpleExamples } from "../../components/simple-examples";

export default function ExamplesPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Example</span></div>
        <Link className="btn primary" href="/author">Describe your own AI use →</Link>
      </header>
      <section className="hero" style={{ paddingTop: 24, paddingBottom: 18 }}>
        <div><h1 style={{ fontSize: "clamp(32px, 5vw, 55px)" }}>What would someone need to know?</h1></div>
        <p className="hero-copy">Compare a simple AI task with decisions that affect people. Open the full explanation only if you need more detail.</p>
      </section>
      <SimpleExamples />
    </main>
  );
}
