import Link from "next/link";
import { LiveRuntimeWorkbench } from "../../components/live-runtime-workbench";

export default function LiveRuntimePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Interactive example</span></div>
        <Link className="btn ghost" href="/examples">Other examples</Link>
      </header>
      <section className="hero" style={{ paddingTop: 25, paddingBottom: 23 }}>
        <div><h1 style={{ fontSize: "clamp(35px, 5vw, 61px)" }}>See the difference between saying and knowing.</h1></div>
        <p className="hero-copy">A simple, fictional funding decision shows what AI-use records can tell us — and what we still have to ask.</p>
      </section>
      <LiveRuntimeWorkbench />
    </main>
  );
}
