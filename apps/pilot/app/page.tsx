import Link from "next/link";

const uses = [
  {
    name: "Funding application review",
    power: "AI recommends · Person decides",
    summary: "AI highlights possible eligibility evidence for a funding officer to review.",
    status: "3 claims backed by evidence",
    unknown: "1 thing remains unknown",
  },
  {
    name: "Writing assistant",
    power: "AI drafts · Person controls the output",
    summary: "AI helps staff draft and improve text; staff remain responsible for what is sent.",
    status: "Explained",
    unknown: "No case record needed",
  },
  {
    name: "Research assistant",
    power: "AI finds information · Person interprets",
    summary: "AI surfaces material for a person to assess before it informs any decision.",
    status: "Needs review",
    unknown: "Evidence not yet linked",
  },
];

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="wordmark">CRUX</span>
          <span className="beta">0.1 beta pilot</span>
        </div>
        <div className="toolbar-group">
          <Link className="btn primary" href="/author">+ Add an AI use</Link>
        </div>
      </header>

      <section className="hero" style={{ paddingTop: "clamp(36px, 6vw, 68px)", paddingBottom: 30 }}>
        <div>
          <div className="eyebrow">Understand and explain AI use</div>
          <h1 style={{ fontSize: "clamp(48px, 7vw, 88px)", maxWidth: 920 }}>
            Make AI use understandable.
          </h1>
        </div>
        <p className="hero-copy">
          CRUX creates clear, evidence-backed records of where AI matters in an organisation:
          where it enters a process, what power it has, what supports the claims made about it,
          and what happened in a particular case when that matters.
        </p>
      </section>

      <section className="panel">
        <div className="context-line">
          <div>
            <div className="kicker">Your AI uses</div>
            <h2 style={{ margin: "6px 0 0" }}>Start with the work, not the technology.</h2>
          </div>
          <Link className="btn primary" href="/author">+ Add an AI use</Link>
        </div>

        <div className="grid" style={{ marginTop: 20 }}>
          {uses.map((use) => (
            <article className="card" key={use.name}>
              <div className="kicker">{use.power}</div>
              <h3>{use.name}</h3>
              <p className="small muted">{use.summary}</p>
              <div className="example-signals">
                <div><strong>SHOWS</strong><span>{use.status}</span></div>
                <div><strong>UNKNOWN</strong><span>{use.unknown}</span></div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="kicker">Add an AI use</div>
        <h2 style={{ marginTop: 6 }}>Start from what you already know.</h2>
        <p className="body-copy muted" style={{ maxWidth: 820 }}>
          You can describe a use yourself, or connect a project and let CRUX find technical signals first.
          Either way, CRUX asks people to supply the organisational meaning that technology cannot know.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <Link className="btn primary" href="/author">Describe it myself</Link>
          <Link className="btn" href="/discover">Connect a project</Link>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="kicker">Every CRUX record answers four questions</div>
        <div className="question-strip" style={{ marginTop: 14 }}>
          <div className="question-tab active"><span className="question-number">01</span><span><strong>Where is AI involved?</strong><small>See the real-world process and where AI enters it.</small></span></div>
          <div className="question-tab"><span className="question-number">02</span><span><strong>What power does it have?</strong><small>Understand what AI can influence, decide or cause.</small></span></div>
          <div className="question-tab"><span className="question-number">03</span><span><strong>What supports this?</strong><small>Keep what is said separate from what the evidence shows.</small></span></div>
          <div className="question-tab"><span className="question-number">04</span><span><strong>What happened here?</strong><small>Explain a particular consequential case when needed.</small></span></div>
        </div>
        <div className="mental-footer" style={{ marginTop: 16 }}>
          <span><strong>SAYS</strong> is what the organisation declares.</span>
          <span><strong>SHOWS</strong> is evidence that supports, qualifies or challenges it.</span>
          <span><strong>UNKNOWN</strong> stays visible.</span>
          <span><strong>HAPPENED</strong> is one particular case.</span>
        </div>
      </section>

      <footer className="footer-note">
        <span>CRUX is not a trust score or compliance badge. It keeps declarations, evidence and outcomes distinct.</span>
        <span><Link href="/live">Runtime tools</Link> · <Link href="/test">Technical tests</Link></span>
      </footer>
    </main>
  );
}
