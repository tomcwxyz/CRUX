import Link from "next/link";
import { DiscoverySourceChoice } from "../../components/discovery-source-choice";

export default function DiscoverPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Connect a project</span></div>
        <Link className="btn ghost" href="/author">Describe it yourself</Link>
      </header>
      <section className="hero" style={{ paddingTop: 20, paddingBottom: 14 }}>
        <div><h1 style={{ fontSize: "clamp(34px, 5vw, 56px)" }}>Find AI in your tools and projects.</h1></div>
        <p className="hero-copy">Start with a SaaS platform or a Git repository. CRUX distinguishes supplier claims, technical evidence and what still needs human confirmation.</p>
      </section>
      <DiscoverySourceChoice />
    </main>
  );
}
