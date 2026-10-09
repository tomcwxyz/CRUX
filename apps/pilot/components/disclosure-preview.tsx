"use client";

import { useMemo, useState } from "react";
import { redactBundle, type CruxPortableBundle } from "@crux/formats";
import { buildReaderModel, type Audience } from "../lib/reader-model";
import { SimpleUseCard } from "./simple-use-card";
import styles from "./simple-ai-use-workbench.module.css";

type ExternalAudience = Extract<Audience, "public" | "affected_party">;

export function DisclosurePreview({
  bundle,
  defaultAudience = "public",
}: {
  bundle: CruxPortableBundle;
  defaultAudience?: ExternalAudience;
}) {
  const [audience, setAudience] = useState<ExternalAudience>(defaultAudience);
  const model = useMemo(() => {
    // An external audience is ALWAYS rendered from a purpose-built disclosure.
    // Never select the use from the original internal bundle afterwards.
    const projection = redactBundle(bundle, audience);
    return buildReaderModel({ kind: "disclosure", projection }, bundle.ai_uses[0]?.id);
  }, [bundle, audience]);

  return (
    <section className={styles.disclosurePreview} aria-label="Preview external explanation">
      <h3>What could other people see?</h3>
      <p>These are separate, disclosure-safe views. This is a preview only — nothing is published by opening it.</p>
      <div className={styles.previewChoices} role="group" aria-label="Who is reading this explanation?">
        <button className="btn" type="button" aria-pressed={audience === "public"}
          onClick={() => setAudience("public")}>Someone from the public</button>
        <button className="btn" type="button" aria-pressed={audience === "affected_party"}
          onClick={() => setAudience("affected_party")}>Someone affected by a decision</button>
      </div>
      {model.availability === "ready" ? (
        <SimpleUseCard model={model} />
      ) : (
        <div className={styles.notShared}>
          <strong>No explanation is available to this audience.</strong>
          <p>This AI use has not been included in this disclosure. Nothing from the private working record has been substituted.</p>
        </div>
      )}
    </section>
  );
}
