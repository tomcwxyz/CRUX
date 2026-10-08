import Link from "next/link";
import { LiveRuntimeWorkbench } from "../../components/live-runtime-workbench";

export default function LiveRuntimePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Runtime example</span></div>
        <Link className="btn ghost" href="/examples">Back to examples</Link>
      </header>
      <section className="hero" style={{ paddingTop: 22, paddingBottom: 20 }}>
        <div><h1 style={{ fontSize: "clamp(35px, 5vw, 58px)" }}>What actually happened?</h1></div>
        <p className="hero-copy">A separate, synthetic funding-review demo. See observations, compare them with the description and review a case before anything is shared.</p>
      </section>
      <LiveRuntimeWorkbench />
    </main>
  );
}
