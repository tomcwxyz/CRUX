import Link from "next/link";
import gatewayRuntimeJson from "../../../../examples/discovery/gateway-runtime.json";
import { DiscoveryOnboarding } from "../../components/discovery-onboarding";

export default function RuntimeDiscoveryPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="wordmark">CRUX</span><span className="beta">runtime discovery test</span></div>
        <div className="toolbar-group"><Link className="btn ghost" href="/discover">Source discovery</Link><Link className="btn ghost" href="/live">Live runtime</Link><div className="top-note">Same onboarding contract, no source-code evidence.</div></div>
      </header>
      <section className="hero" style={{paddingTop:"clamp(32px, 5vw, 58px)",paddingBottom:28}}>
        <div><div className="eyebrow">Second producer test</div><h1 style={{fontSize:"clamp(44px, 6vw, 78px)",maxWidth:920}}>What if CRUX only sees runtime metadata?</h1></div>
        <p className="hero-copy">This uses the real provider/model metadata captured during the production runtime smoke. No repository paths are available. The same discovery contract still has to produce a useful candidate and leave organisational meaning unanswered.</p>
      </section>
      <DiscoveryOnboarding
        reportData={gatewayRuntimeJson}
        connectionName="Production AI gateway observation"
        connectionMeta="Runtime metadata · gateway → anthropic/claude-3-haiku · no prompt/output content"
        initialStage="discover"
        showConnectorChoices={false}
      />
      <footer className="footer-note"><span>This is a connector-contract test, not a finished Vercel AI Gateway OAuth integration.</span><span>Observed model activity can suggest an AI use; it cannot explain why the organisation uses it.</span></footer>
    </main>
  );
}
