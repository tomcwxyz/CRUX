import Link from "next/link";
import { GithubDiscoveryExperience } from "../../components/github-discovery-experience";

export default function DiscoverPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">add an AI use</span></div>
        <div className="toolbar-group"><Link className="btn ghost" href="/">All AI uses</Link><Link className="btn ghost" href="/author">Describe it myself</Link></div>
      </header>

      <section className="hero" style={{paddingTop:"clamp(32px, 5vw, 58px)",paddingBottom:28}}>
        <div>
          <div className="eyebrow">Connect a project</div>
          <h1 style={{fontSize:"clamp(44px, 6vw, 78px)",maxWidth:920}}>Find the AI use, then add the meaning.</h1>
        </div>
        <p className="hero-copy">
          CRUX can look for technical signals in a project you already use. It can suggest where AI appears,
          but a person still confirms what that AI is for, who it can affect and what power it has.
        </p>
      </section>

      <GithubDiscoveryExperience />

      <footer className="footer-note">
        <span>Discovery is only a starting point. Technical evidence never silently becomes an organisational declaration.</span>
        <span><Link href="/discover/runtime">Technical discovery details</Link></span>
      </footer>
    </main>
  );
}
