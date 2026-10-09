import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Link className="wordmark" href="/">CRUX</Link>
          <span className="beta">beta</span>
        </div>
        <Link className="btn ghost" href="/examples">See an example</Link>
      </header>
      <section className="hero" style={{ paddingTop: "clamp(44px, 8vw, 100px)", paddingBottom: 34 }}>
        <div>
          <div className="eyebrow">Understand your AI</div>
          <h1 style={{ fontSize: "clamp(46px, 7vw, 88px)", maxWidth: 850 }}>
            Know what AI does. See what really happens.
          </h1>
        </div>
        <div style={{ display: "grid", gap: 18, alignContent: "center" }}>
          <p className="hero-copy">
            Start with your own description or a project you already use. Then explain what AI does, add evidence and check what actually happens.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn primary" href="/author">Describe an AI use →</Link>
            <Link className="btn" href="/author#connect">Connect a project</Link>
          </div>
        </div>
      </section>
      <footer className="footer-note">
        <span>Clear explanations. Real evidence. Questions worth asking.</span>
        <span><Link href="/examples">Worked example</Link> · <Link href="/live">Try runtime observations</Link></span>
      </footer>
    </main>
  );
}
