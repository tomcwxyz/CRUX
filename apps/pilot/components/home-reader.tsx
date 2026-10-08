"use client";

import { useMemo, useState } from "react";
import {
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";
import { buildReaderModel, type Audience } from "../lib/reader-model";
import { CruxReader } from "./crux-reader";

const examples: Array<{ id: string; name: string; bundle: CruxPortableBundle }> = [
  { id: "writing-assistant", name: "Writing assistant", bundle: parsePortableBundle(writingAssistantJson as unknown) },
  { id: "funding-review", name: "Funding review", bundle: parsePortableBundle(fundingReviewJson as unknown) },
  { id: "bounded-action", name: "Bounded action", bundle: parsePortableBundle(boundedActionJson as unknown) },
];

export function HomeReader() {
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => structuredClone(examples[1]!.bundle));
  const [exampleId, setExampleId] = useState("funding-review");
  const [audience, setAudience] = useState<Audience>("public");
  const [error, setError] = useState<string | null>(null);

  // Lower-disclosure views are only offered for a structurally valid record.
  const canonical = useMemo(() => {
    const parsed = portableBundleSchema.safeParse(bundle);
    return parsed.success && validateBundleReferences(parsed.data).valid ? parsed.data : null;
  }, [bundle]);
  const effectiveAudience: Audience = canonical ? audience : "internal";
  const model = useMemo(() => {
    const useId = bundle.ai_uses[0]?.id;
    return canonical && effectiveAudience !== "internal"
      ? buildReaderModel({ kind: "disclosure", projection: redactBundle(canonical, effectiveAudience) }, useId)
      : buildReaderModel({ kind: "working", bundle }, useId);
  }, [bundle, canonical, effectiveAudience]);

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id);
    if (!example) return;
    setBundle(structuredClone(example.bundle));
    setExampleId(id);
    setAudience("public");
    setError(null);
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setBundle(parsePortableBundle(JSON.parse(await file.text()) as unknown));
      setExampleId("");
      setAudience("public");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this CRUX record.");
    }
  };

  return (
    <CruxReader
      model={model}
      onAudienceChange={setAudience}
      availableAudiences={canonical ? ["internal", "public", "affected_party"] : ["internal"]}
      note={error ?? (canonical ? undefined : "This record is still a draft. Public and affected-person views become available once the record is structurally valid.")}
      toolbar={(
        <>
          <div className="toolbar-group" aria-label="Example records">
            <span className="kicker" style={{ margin: 0 }}>Example</span>
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className={`btn ${exampleId === example.id ? "primary" : "ghost"}`}
                aria-pressed={exampleId === example.id}
                onClick={() => loadExample(example.id)}
              >
                {example.name}
              </button>
            ))}
          </div>
          <div className="toolbar-group">
            <label className="btn file-label">Open your record<input type="file" accept="application/json,.json" onChange={(event) => void openFile(event.target.files?.[0])} /></label>
            <a className="btn" href="/author">Create or edit a record</a>
          </div>
        </>
      )}
    />
  );
}
