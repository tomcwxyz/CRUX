import Link from "next/link";
import { LiveRuntimeWorkbench } from "../../components/live-runtime-workbench";

export default function LiveRuntimePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Interactive example</span></div>
        <Link className="btn ghost" href="/examples">Other examples</Link>
      </header>
      <LiveRuntimeWorkbench />
    </main>
  );
}
