import Link from "next/link";
import { SimpleAIUseWorkbench } from "../../components/simple-ai-use-workbench";

export default function AuthorPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Describe an AI use</span></div>
        <div className="toolbar-group">
          <Link className="btn ghost" href="/records">Your saved records</Link>
          <Link className="btn ghost" href="/examples">See an example</Link>
          <Link className="btn ghost" href="/author/advanced">Detailed editor</Link>
        </div>
      </header>
      <SimpleAIUseWorkbench />
    </main>
  );
}
