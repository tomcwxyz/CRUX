import Link from "next/link";
import { MentalModelWorkbench } from "../../../components/mental-model-workbench";

export default function AdvancedAuthorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Detailed editor</span></div>
        <Link className="btn ghost" href="/author">Simple editor</Link>
      </header>
      <section className="hero" style={{ paddingTop: 26, paddingBottom: 20 }}>
        <div><h1 style={{ fontSize: "clamp(34px, 5vw, 55px)" }}>The full record</h1></div>
        <p className="hero-copy">For complex decisions, automated actions and detailed evidence. Import an existing record to continue working on it.</p>
      </section>
      <MentalModelWorkbench />
    </main>
  );
}
