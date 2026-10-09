import Link from "next/link";
import { SimpleExamples } from "../../components/simple-examples";
import styles from "./page.module.css";

export default function ExamplesPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Link className="wordmark" href="/">CRUX</Link><span className="beta">Example</span></div>
        <Link className="btn primary" href="/author">Describe your own AI use →</Link>
      </header>
      <section className={styles.intro}>
        <span className={styles.eyebrow}>See how CRUX works</span>
        <h1>Where does AI fit in?</h1>
        <p>Start with the process. Open the evidence when you want to look more closely.</p>
      </section>
      <SimpleExamples />
    </main>
  );
}
