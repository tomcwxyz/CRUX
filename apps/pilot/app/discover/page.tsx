import Link from "next/link";
import { GithubDiscoveryExperience } from "../../components/github-discovery-experience";

export default function DiscoverPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Connect a project</span></div>
        <Link className="btn ghost" href="/author">Describe it yourself</Link>
      </header>
      <section className="hero" style={{ paddingTop: 20, paddingBottom: 14 }}>
        <div><h1 style={{ fontSize: "clamp(34px, 5vw, 56px)" }}>Find the AI in your project.</h1></div>
        <p className="hero-copy">We'll look for technical signals. You confirm what the AI is for, who it affects and who decides.</p>
      </section>
      <GithubDiscoveryExperience />
    </main>
  );
}
