"use client";

import { useMemo, useState } from "react";
import { parsePortableBundle, redactBundle, type CruxPortableBundle } from "@crux/formats";
import writingJson from "../../../examples/writing-assistant/crux.json";
import fundingJson from "../../../examples/funding-review/crux.json";
import actionJson from "../../../examples/bounded-action/crux.json";
import { buildReaderModel, type Audience } from "../lib/reader-model";
import { observedBehaviourForVersion } from "../lib/observed";
import { ProcessFlow } from "./process-flow";
import { SimpleUseCard } from "./simple-use-card";
import styles from "./simple-examples.module.css";

const examples: Array<{ name: string; bundle: CruxPortableBundle }> = [
  { name: "Writing assistant", bundle: parsePortableBundle(writingJson as unknown) },
  { name: "Funding review", bundle: parsePortableBundle(fundingJson as unknown) },
  { name: "AI taking action", bundle: parsePortableBundle(actionJson as unknown) },
];

const audiences: Array<{ value: Audience; label: string }> = [
  { value: "public", label: "Public" },
  { value: "affected_party", label: "Person affected" },
  { value: "internal", label: "Internal" },
];

export function SimpleExamples() {
  const [selected, setSelected] = useState(1);
  const [audience, setAudience] = useState<Audience>("public");
  const bundle = examples[selected]!.bundle;
  const selectedUseId = bundle.ai_uses[0]?.id;
  const model = useMemo(() => audience === "internal"
    ? buildReaderModel({ kind: "working", bundle }, selectedUseId)
    : buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, audience) }, selectedUseId),
    [bundle, audience, selectedUseId],
  );
  const runtime = useMemo(() => {
    if (audience !== "internal") return undefined;
    const use = bundle.ai_uses[0];
    const system = bundle.systems.find((item) => use?.system_refs.includes(item.id) || item.ai_use_refs.includes(use?.id ?? ""));
    return observedBehaviourForVersion(bundle, system?.current_version_ref);
  }, [bundle, audience]);

  const authority = model.decisions[0]?.authority ?? model.humanCheckpoint ?? model.canActAlone;
  const lastStep = model.process?.steps.at(-1)?.name;
  const caseRecord = audience === "affected_party" ? model.cases[0] : undefined;

  return (
    <div className={styles.examples}>
      <div className={styles.controls}>
        <div className={styles.exampleChooser}>
          <span className={styles.controlLabel}>Explore an example</span>
          <div className={styles.exampleChoices} role="group" aria-label="Choose example">
            {examples.map((item, index) => (
              <button key={item.name} type="button" className={styles.exampleChoice}
                aria-pressed={index === selected}
                onClick={() => { setSelected(index); setAudience("public"); }}>
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.audienceChooser}>
          <span className={styles.controlLabel}>Read as</span>
          <div className={styles.audienceChoices} role="group" aria-label="Who is reading?">
            {audiences.map((item) => (
              <button key={item.value} type="button" className={styles.audienceChoice}
                aria-pressed={item.value === audience} onClick={() => setAudience(item.value)}>{item.label}</button>
            ))}
          </div>
        </div>
      </div>

      {model.availability !== "ready" || !model.use ? (
        <section className={styles.unavailable}>
          <h2>This AI use is not visible in this view.</h2>
          <p>The organisation has not made this part of the record available to this audience. No internal details have been substituted.</p>
        </section>
      ) : (
        <>
          <section className={styles.overview} aria-label="The AI process">
            <header className={styles.overviewHeader}>
              <div className={styles.overviewIntro}>
                <span className={styles.kicker}>The process at a glance</span>
                <h2>{model.use.name}</h2>
                <p>{model.use.summary ?? "No plain-language description has been recorded."}</p>
              </div>
              {model.use.consequential ? <span className={styles.impact}>May materially affect people</span> : null}
            </header>

            {model.process?.steps.length ? (
              <ProcessFlow steps={model.process.steps} prominent />
            ) : (
              <p className={styles.missing}>There is no process diagram available in this view yet.</p>
            )}

            <dl className={styles.takeaways}>
              <div>
                <dt>What AI does</dt>
                <dd>{model.aiCan.join(" · ") || "Not yet recorded"}</dd>
              </div>
              <div>
                <dt>Who decides or acts</dt>
                <dd>{authority || "Not yet recorded"}</dd>
              </div>
              <div>
                <dt>What follows</dt>
                <dd>{lastStep ?? "Not yet recorded"}</dd>
              </div>
            </dl>

            {audience === "affected_party" ? (
              <section className={styles.casePreview} aria-label="What happened in this case">
                <span className={styles.kicker}>In this particular case</span>
                {caseRecord ? (
                  <>
                    <p><strong>AI contributed:</strong> {caseRecord.aiContribution}</p>
                    <p><strong>Outcome:</strong> {caseRecord.outcome}</p>
                    <p><strong>Final authority:</strong> {caseRecord.finalAuthority}</p>
                    <p><strong>Questions or challenges:</strong> {caseRecord.challenge?.text ?? "No route is recorded in this view."}</p>
                  </>
                ) : <p>No explanation of an individual case is visible here yet. This general process is not a record of what happened to a particular person.</p>}
              </section>
            ) : null}
          </section>

          <details className={styles.more}>
            <summary>
              <span className={styles.moreLabel}>Explore the evidence and questions <span aria-hidden="true">↗</span></span>
              <span className={styles.moreHint}>What the organisation says, what the evidence shows and what remains unknown.</span>
            </summary>
            <div className={styles.moreContent}>
              <SimpleUseCard model={model} observed={runtime} showOverview={false} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
