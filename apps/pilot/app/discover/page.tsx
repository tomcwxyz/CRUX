import Link from "next/link";
import { GithubDiscoveryExperience } from "../../components/github-discovery-experience";

export default function DiscoverPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="wordmark">CRUX</span><span className="beta">discovery pilot</span></div>
        <div className="toolbar-group"><Link className="btn ghost" href="/">Audience views</Link><Link className="btn ghost" href="/live">Live runtime</Link><div className="top-note">Connect → discover → confirm → observe.</div></div>
      </header>
      <section className="hero" style={{paddingTop:"clamp(32px, 5vw, 58px)",paddingBottom:28}}>
        <div><div className="eyebrow">Find the AI you already have</div><h1 style={{fontSize:"clamp(44px, 6vw, 78px)",maxWidth:920}}>Don't start with a blank form.</h1></div>
        <p className="hero-copy">CRUX should begin with evidence from the tools and workflows you already use. It discovers technical signals, then asks people to supply only the meaning technology cannot know.</p>
      </section>
      <div style={{display:"flex",justifyContent:"flex-end",margin:"0 0 14px"}}><Link className="btn ghost" href="/discover/runtime">Compare with runtime discovery →</Link></div>
      <GithubDiscoveryExperience />
      <footer className="footer-note"><span>The hosted pilot accepts public GitHub repositories; Open Recommendations Local remains the first regression target.</span><span>Discovery evidence is metadata-only and is not a declaration until a person confirms it.</span></footer>
    </main>
  );
}
