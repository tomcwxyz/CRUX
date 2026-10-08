"use client";

import { useMemo, useState } from "react";
import { parsePortableBundle, redactBundle, type CruxPortableBundle } from "@crux/formats";
import writingJson from "../../../examples/writing-assistant/crux.json";
import fundingJson from "../../../examples/funding-review/crux.json";
import actionJson from "../../../examples/bounded-action/crux.json";
import { buildReaderModel, type Audience } from "../lib/reader-model";
import { observedBehaviourForVersion } from "../lib/observed";
import { SimpleUseCard } from "./simple-use-card";

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
  const runtime = useMemo(() => {
    const use = bundle.ai_uses[0];
    const system = bundle.systems.find((item) => use?.system_refs.includes(item.id) || item.ai_use_refs.includes(use?.id ?? ""));
    return audience === "internal"
      ? observedBehaviourForVersion(bundle, system?.current_version_ref)
      : undefined;
  }, [bundle, audience]);
  const model = useMemo(() => audience === "internal"
    ? buildReaderModel({ kind: "working", bundle })
    : buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, audience) }),
    [bundle, audience],
  );
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="toolbar-group" role="group" aria-label="Choose example" style={{ marginBottom: 14 }}>
        {examples.map((item, index) => (
          <button key={item.name} type="button" className={`btn ${index === selected ? "primary" : "ghost"}`}
            aria-pressed={index === selected} onClick={() => { setSelected(index); setAudience("public"); }}>
            {item.name}
          </button>
        ))}
      </div>
      <div className="toolbar-group" role="group" aria-label="Who is reading?" style={{ marginBottom: 20 }}>
        {audiences.map((item) => (
          <button key={item.value} type="button" className={`btn ${item.value === audience ? "primary" : "ghost"}`}
            aria-pressed={item.value === audience} onClick={() => setAudience(item.value)}>{item.label}</button>
        ))}
      </div>
      <SimpleUseCard model={model} observed={runtime} />
    </div>
  );
}
