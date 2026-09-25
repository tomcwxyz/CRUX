"use client";

import { useMemo, useState } from "react";
import {
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxDisclosureBundle,
  type CruxPortableBundle,
} from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";
import { appendAIUse } from "../lib/authoring";
import { authorityLabel, evidenceKindLabel } from "../lib/labels";
import { observedBehaviourForVersion } from "../lib/observed";
import { createStarterBundle } from "../lib/starter";
import { AuthorityEditor } from "./authority-editor";
import { EvidenceEditor } from "./evidence-editor";
import { ReceiptEditor } from "./receipt-editor";

type Lens = "working" | "public" | "affected_party";
type Mode = "read" | "edit";

type ViewUse = {
  id: string;
  name: string;
  summary: string;
  consequential: boolean;
  peopleAffected: string[];
};

type ViewSystem = {
  id: string;
  name: string;
  description: string;
  influence: AIInfluence[];
  agency: AIAgency;
};

type ViewVersion = {
  id: string;
  processName: string;
  nodes: Array<{ id: string; type: string; name: string; description?: string }>;
  decisions: Array<{ id: string; name: string; authority: string; reviewBeforeEffect: boolean }>;
  actions: Array<{
    id: string;
    name: string;
    initiatedBy: string;
    humanApprovalRequired: boolean;
    reversibility: string;
    scope: string;
  }>;
};

type ViewClaim = { id: string; statement: string };
type ViewEvidence = {
  id: string;
  kind: string;
  summary: string;
  limitations: string[];
  externalRefs: string[];
};
type ViewLink = { claimRef: string; evidenceRef: string; relationship: string };
type ViewReceipt = {
  id: string;
  aiSummary: string;
  effectOfAi: string;
  humanInvolvement?: string;
  finalAuthority: string;
  outcome: string;
  challenge?: NonNullable<CruxPortableBundle["receipts"][number]["challenge"]>;
};

type ViewModel = {
  organisationName: string;
  use?: ViewUse;
  system?: ViewSystem;
  version?: ViewVersion | undefined;
  claims: ViewClaim[];
  evidence: ViewEvidence[];
  links: ViewLink[];
  receipts: ViewReceipt[];
};

type ExampleCase = {
  id: string;
  name: string;
  note: string;
  bundle: CruxPortableBundle;
};

const examples: ExampleCase[] = [
  {
    id: "writing-assistant",
    name: "Writing assistant",
    note: "Low consequence",
    bundle: parsePortableBundle(writingAssistantJson as unknown),
  },
  {
    id: "funding-review",
    name: "Funding review",
    note: "Human decision",
    bundle: parsePortableBundle(fundingReviewJson as unknown),
  },
  {
    id: "bounded-action",
    name: "Bounded action",
    note: "Agentic workflow",
    bundle: parsePortableBundle(boundedActionJson as unknown),
  },
];

const lensLabel: Record<Lens, string> = {
  working: "Internal",
  public: "Public",
  affected_party: "Affected person",
};

const influenceChoices: Array<{ value: AIInfluence; label: string; help: string }> = [
  { value: "assistive", label: "Draft or transform", help: "AI helps produce or change content." },
  { value: "informational", label: "Find or surface information", help: "AI brings information to someone’s attention." },
  { value: "advisory", label: "Recommend", help: "AI suggests what someone might do or decide." },
  { value: "conditional", label: "Influence what happens next", help: "AI affects a later step when conditions are met." },
  { value: "decisional", label: "Contribute directly to a decision", help: "AI output forms part of the decision itself." },
];

const agencyChoices: Array<{ value: AIAgency; label: string; short: string }> = [
  { value: "none", label: "AI cannot cause an action", short: "No" },
  { value: "proposes_action", label: "AI can propose an action, but cannot execute it", short: "It can propose one" },
  { value: "human_approval_required", label: "AI can act only after a person approves", short: "Only after approval" },
  { value: "automatic_bounded", label: "AI can act automatically within fixed limits", short: "Within fixed limits" },
  { value: "autonomous_bounded", label: "AI can choose and act within defined limits", short: "Within defined limits" },
];

const nodeLabels: Record<string, string> = {
  input: "Information",
  data_source: "Information",
  transformation: "Step",
  ai: "AI",
  rule: "Rule",
  decision: "Decision",
  human: "Person",
  action: "Action",
  output: "Outcome",
  external_system: "External system",
};

const relationshipLabel = (relationship: string) => {
  if (relationship === "supports") return "Supports";
  if (relationship === "qualifies") return "Qualifies";
  if (relationship === "contradicts") return "Challenges";
  return "Inconclusive";
};

const formatError = (error: unknown) =>
  error instanceof Error ? error.message : "That file could not be opened as a CRUX record.";

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "crux";

const downloadJson = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const selectedCanonicalSystem = (
  bundle: CruxPortableBundle,
  use: CruxPortableBundle["ai_uses"][number] | undefined,
) => {
  if (!use) return undefined;
  return bundle.systems.find(
    (system) => use.system_refs.includes(system.id) || system.ai_use_refs.includes(use.id),
  );
};

const selectedCanonicalVersion = (
  bundle: CruxPortableBundle,
  system: CruxPortableBundle["systems"][number] | undefined,
) => {
  if (!system) return undefined;
  return system.current_version_ref
    ? bundle.system_versions.find((version) => version.id === system.current_version_ref)
    : bundle.system_versions.find((version) => version.system_ref === system.id);
};

const relevantClaim = (
  claim: { applies_to: Array<{ ref: string }> },
  refs: Set<string>,
) => claim.applies_to.some((target) => refs.has(target.ref));

const normaliseVersion = (
  version: CruxPortableBundle["system_versions"][number] | CruxDisclosureBundle["system_versions"][number] | undefined,
): ViewVersion | undefined => {
  if (!version) return undefined;
  return {
    id: version.id,
    processName: version.process.name,
    nodes: version.process.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.description ? { description: node.description } : {}),
    })),
    decisions: version.decisions.map((decision) => ({
      id: decision.id,
      name: decision.name,
      authority: decision.authority,
      reviewBeforeEffect: decision.review_before_effect,
    })),
    actions: version.actions.map((action) => ({
      id: action.id,
      name: action.name,
      initiatedBy: action.initiated_by,
      humanApprovalRequired: action.human_approval_required,
      reversibility: action.reversibility,
      scope: action.scope.summary,
    })),
  };
};

const buildWorkingView = (bundle: CruxPortableBundle, selectedUseId: string): ViewModel => {
  const use = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = bundle.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = bundle.evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = bundle.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = version
    ? bundle.receipts.filter((receipt) => receipt.system_version_ref === version.id)
    : [];

  return {
    organisationName: bundle.organisations[0]?.name ?? "Your organisation",
    ...(use ? {
      use: {
        id: use.id,
        name: use.name,
        summary: use.public_summary || use.purpose,
        consequential: use.consequential,
        peopleAffected: use.people_affected,
      },
    } : {}),
    ...(system ? {
      system: {
        id: system.id,
        name: system.name,
        description: system.description,
        influence: [...system.influence],
        agency: system.agency,
      },
    } : {}),
    ...(version ? { version: normaliseVersion(version) } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      summary: item.summary,
      limitations: item.limitations,
      externalRefs: item.external_refs,
    })),
    links: links.map((link) => ({
      claimRef: link.claim_ref,
      evidenceRef: link.evidence_ref,
      relationship: link.relationship,
    })),
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      aiSummary: receipt.ai_summary,
      effectOfAi: receipt.effect_of_ai,
      ...(receipt.human_involvement ? { humanInvolvement: receipt.human_involvement } : {}),
      finalAuthority: receipt.final_authority,
      outcome: receipt.outcome,
      ...(receipt.challenge ? { challenge: receipt.challenge } : {}),
    })),
  };
};

const buildDisclosureView = (projection: CruxDisclosureBundle, selectedUseId: string): ViewModel => {
  const use = projection.ai_uses.find((item) => item.id === selectedUseId) ?? projection.ai_uses[0];
  const system = use
    ? projection.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id))
    : undefined;
  const version = system?.current_version_ref
    ? projection.system_versions.find((item) => item.id === system.current_version_ref)
    : projection.system_versions.find((item) => item.system_ref === system?.id);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = projection.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = projection.claim_evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = projection.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = projection.trace_views.flatMap((trace) => {
    if (!trace.receipt || (version && trace.receipt.system_version_ref !== version.id)) return [];
    return [{
      id: trace.receipt.id,
      aiSummary: trace.receipt.ai_summary,
      effectOfAi: trace.receipt.effect_of_ai,
      ...(trace.receipt.human_involvement ? { humanInvolvement: trace.receipt.human_involvement } : {}),
      finalAuthority: trace.receipt.final_authority,
      outcome: trace.receipt.outcome,
      ...(trace.receipt.challenge ? { challenge: trace.receipt.challenge } : {}),
    }];
  });

  return {
    organisationName: projection.organisations[0]?.name ?? "Organisation",
    ...(use ? {
      use: {
        id: use.id,
        name: use.name,
        summary: use.public_summary ?? "No public summary has been provided.",
        consequential: use.consequential,
        peopleAffected: use.people_affected,
      },
    } : {}),
    ...(system ? {
      system: {
        id: system.id,
        name: system.name,
        description: system.description,
        influence: [...system.influence],
        agency: system.agency,
      },
    } : {}),
    ...(version ? { version: normaliseVersion(version) } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      summary: item.summary,
      limitations: item.limitations,
      externalRefs: item.external_refs,
    })),
    links: links.map((link) => ({
      claimRef: link.claim_ref,
      evidenceRef: link.evidence_ref,
      relationship: link.relationship,
    })),
    receipts,
  };
};

const powerSummary = (system: ViewSystem | undefined) => {
  if (!system) return ["No system details recorded yet."];
  return system.influence.map((value) =>
    influenceChoices.find((choice) => choice.value === value)?.label ?? value.replaceAll("_", " "),
  );
};

const agencySummary = (system: ViewSystem | undefined) => {
  if (!system) return "Unknown";
  return agencyChoices.find((choice) => choice.value === system.agency)?.short ?? "Unknown";
};

const humanCheckpoint = (view: ViewModel) => {
  const person = view.version?.nodes.find((node) => node.type === "human");
  if (person) return person.name;
  const decision = view.version?.decisions[0];
  if (decision?.authority) return authorityLabel(decision.authority);
  return "Not recorded";
};

const clarityStyles = `
  .clarity-workbench { overflow: hidden; }
  .clarity-workbench .toolbar { background: rgba(255,255,255,.42); }
  .clarity-toolbar-label { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; margin-right: 2px; }
  .clarity-example-button { border: 0; background: transparent; color: var(--muted); padding: 7px 9px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; }
  .clarity-example-button:hover, .clarity-example-button.active { background: var(--chalk); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
  .clarity-summary { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: 24px; padding: clamp(24px, 4vw, 48px); border-bottom: 1px solid var(--line); background: rgba(255,253,248,.72); }
  .clarity-summary h2 { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(34px, 5vw, 62px); font-weight: 400; letter-spacing: -.045em; line-height: 1; margin: 6px 0 14px; }
  .clarity-summary-copy { color: var(--muted); font-size: 17px; line-height: 1.6; max-width: 780px; margin: 0; }
  .clarity-impact { margin-top: 18px; display: flex; gap: 8px; flex-wrap: wrap; }
  .clarity-facts { border: 1px solid var(--line); border-radius: 22px; background: rgba(255,255,255,.42); overflow: hidden; align-self: start; }
  .clarity-fact { padding: 16px 18px; border-top: 1px solid var(--line); display: grid; gap: 5px; }
  .clarity-fact:first-child { border-top: 0; }
  .clarity-fact span { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
  .clarity-fact strong { font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 400; line-height: 1.3; }
  .clarity-path { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid var(--line); background: rgba(255,255,255,.28); }
  .clarity-path button { border: 0; border-right: 1px solid var(--line); background: transparent; text-align: left; cursor: pointer; padding: 13px 16px; color: var(--muted); }
  .clarity-path button:last-child { border-right: 0; }
  .clarity-path button:hover { background: rgba(255,253,248,.8); color: var(--ink); }
  .clarity-path span { display: block; color: var(--rust); font-family: Georgia, 'Times New Roman', serif; font-size: 15px; margin-bottom: 3px; }
  .clarity-path strong { display: block; font-size: 12px; line-height: 1.25; }
  .clarity-reading { padding: 0 clamp(22px, 4vw, 48px) 44px; }
  .clarity-section { scroll-margin-top: 20px; padding: 38px 0 10px; border-top: 1px solid var(--line); }
  .clarity-section:first-child { border-top: 0; }
  .clarity-section .question-heading { margin-bottom: 22px; grid-template-columns: 48px minmax(0, 1fr); }
  .clarity-section .question-heading > span { font-size: 30px; }
  .clarity-section .question-heading h2 { font-size: clamp(28px, 3.5vw, 42px); }
  .clarity-section .question-heading p { font-size: 15px; }
  .clarity-section .guidance { margin: 16px 0 0; grid-template-columns: 120px 1fr; padding: 13px 15px; }
  .clarity-teaching { display: grid; grid-template-columns: 160px 1fr; gap: 18px; border-left: 3px solid var(--moss); padding: 13px 0 13px 16px; margin: 0 0 22px; }
  .clarity-teaching strong { color: var(--moss); }
  .clarity-teaching span { color: var(--muted); line-height: 1.5; font-size: 14px; }
  .clarity-plain-label { display: flex; align-items: baseline; gap: 9px; margin-bottom: 8px; }
  .clarity-plain-label b { font-size: 10px; letter-spacing: .13em; color: var(--muted); }
  .clarity-plain-label span { font-size: 12px; color: var(--muted); }
  .clarity-unknown { border-left: 3px solid var(--unknown); padding: 14px 16px; background: rgba(119,120,111,.07); border-radius: 0 14px 14px 0; }
  .clarity-unknown strong { display: block; margin-bottom: 4px; }
  .clarity-unknown p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
  .clarity-record-tools { margin: 0; padding: 14px 18px; border-top: 0; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.2); }
  .clarity-record-tools[open] summary { margin-bottom: 12px; }
  .clarity-edit-shell { padding: clamp(24px, 4vw, 48px); }
  .clarity-edit-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 22px; margin-bottom: 28px; border-bottom: 1px solid var(--line); }
  .clarity-mode-note { color: var(--muted); font-size: 13px; line-height: 1.45; max-width: 620px; }
  @media (max-width: 900px) {
    .clarity-summary { grid-template-columns: 1fr; }
    .clarity-path { grid-template-columns: repeat(2, 1fr); }
    .clarity-path button:nth-child(2) { border-right: 0; }
    .clarity-path button:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
  }
  @media (max-width: 680px) {
    .clarity-path { grid-template-columns: 1fr; }
    .clarity-path button { border-right: 0; border-bottom: 1px solid var(--line); }
    .clarity-path button:last-child { border-bottom: 0; }
    .clarity-teaching { grid-template-columns: 1fr; gap: 6px; }
    .clarity-edit-top { align-items: flex-start; flex-direction: column; }
  }
`;

export function ClarityWorkbench() {
  const initial = examples[1]!.bundle;
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => structuredClone(initial));
  const [selectedUseId, setSelectedUseId] = useState(initial.ai_uses[0]?.id ?? "");
  const [lens, setLens] = useState<Lens>("working");
  const [mode, setMode] = useState<Mode>("read");
  const [activeExample, setActiveExample] = useState<string | null>("funding-review");
  const [error, setError] = useState<string | null>(null);

  const structural = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const references = useMemo(
    () => structural.success ? validateBundleReferences(structural.data) : null,
    [structural],
  );
  const canonical = structural.success && references?.valid ? structural.data : null;
  const effectiveLens: Lens = canonical ? lens : "working";
  const projection = useMemo(
    () => canonical && effectiveLens !== "working" ? redactBundle(canonical, effectiveLens) : null,
    [canonical, effectiveLens],
  );
  const view = useMemo(
    () => projection ? buildDisclosureView(projection, selectedUseId) : buildWorkingView(bundle, selectedUseId),
    [projection, bundle, selectedUseId],
  );

  const use = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claim = bundle.claims.find((item) => relevantClaim(item, refs));
  const observed = useMemo(() => observedBehaviourForVersion(bundle, version?.id), [bundle, version?.id]);
  const canShare = canonical !== null;
  const isFundingExample = activeExample === "funding-review";

  const mutate = (change: (next: CruxPortableBundle) => void) => {
    setBundle((current) => {
      const next = structuredClone(current);
      change(next);
      next.generated_at = new Date().toISOString();
      return next;
    });
    setActiveExample(null);
  };

  const updateUse = (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => {
    if (!use) return;
    mutate((next) => {
      const target = next.ai_uses.find((item) => item.id === use.id);
      if (target) Object.assign(target, patch);
    });
  };

  const updateSystem = (patch: Partial<CruxPortableBundle["systems"][number]>) => {
    if (!system) return;
    mutate((next) => {
      const target = next.systems.find((item) => item.id === system.id);
      if (target) Object.assign(target, patch);
    });
  };

  const toggleInfluence = (value: AIInfluence, checked: boolean) => {
    if (!system) return;
    const influence = checked
      ? Array.from(new Set([...system.influence, value]))
      : system.influence.filter((item) => item !== value);
    if (influence.length > 0) updateSystem({ influence });
  };

  const loadExample = (example: ExampleCase) => {
    const next = structuredClone(example.bundle);
    setBundle(next);
    setSelectedUseId(next.ai_uses[0]?.id ?? "");
    setLens("working");
    setMode("read");
    setActiveExample(example.id);
    setError(null);
  };

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(parsed);
      setSelectedUseId(parsed.ai_uses[0]?.id ?? "");
      setLens("working");
      setMode("read");
      setActiveExample(null);
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const startNew = () => {
    const starter = createStarterBundle();
    setBundle(starter);
    setSelectedUseId(starter.ai_uses[0]?.id ?? "");
    setLens("working");
    setMode("edit");
    setActiveExample(null);
    setError(null);
  };

  const addUse = () => {
    const result = appendAIUse(bundle);
    setBundle(result.bundle);
    setSelectedUseId(result.aiUseId);
    setLens("working");
    setMode("edit");
    setActiveExample(null);
  };

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const baseName = slug(bundle.organisations[0]?.name ?? "crux");
  const exportValue = projection ?? canonical;
  const human = humanCheckpoint(view);
  const aiRole = powerSummary(view.system).join(" · ");
  const actionPower = agencySummary(view.system);

  return (
    <section className="workbench clarity-workbench" aria-label="CRUX pilot workbench">
      <style>{clarityStyles}</style>

      <div className="toolbar">
        <div className="toolbar-group" aria-label="Example records">
          <span className="clarity-toolbar-label">Try an example</span>
          {examples.map((example) => (
            <button
              className={`clarity-example-button ${activeExample === example.id ? "active" : ""}`}
              type="button"
              key={example.id}
              onClick={() => loadExample(example)}
              title={example.note}
            >
              {example.name}
            </button>
          ))}
          <button className="btn ghost" type="button" onClick={startNew}>Start your own</button>
        </div>

        {mode === "read" ? (
          <div className="toolbar-group" aria-label="Record audience">
            <span className="clarity-toolbar-label">View as</span>
            {(["working", "public", "affected_party"] as Lens[]).map((item) => (
              <button
                key={item}
                className={`btn ${effectiveLens === item ? "primary" : "ghost"}`}
                type="button"
                disabled={item !== "working" && !canShare}
                onClick={() => setLens(item)}
              >
                {lensLabel[item]}
              </button>
            ))}
            <button
              className="btn"
              type="button"
              onClick={() => {
                setLens("working");
                setMode("edit");
              }}
            >
              Edit this record
            </button>
          </div>
        ) : (
          <button className="btn primary" type="button" onClick={() => setMode("read")}>Back to reading view</button>
        )}
      </div>

      {error ? <div className="error-box" style={{ margin: 18 }}>{error}</div> : null}

      {mode === "read" ? (
        <>
          <section className="clarity-summary">
            <div>
              <div className="kicker">{view.organisationName} · {lensLabel[effectiveLens]} view</div>
              <h2>{view.use?.name ?? "AI use not yet described"}</h2>
              <p className="clarity-summary-copy">
                {view.use?.summary ?? view.system?.description ?? "No plain-language explanation has been recorded yet."}
              </p>
              <div className="clarity-impact">
                {view.use?.consequential ? <span className="impact-flag">May materially affect people</span> : <span className="impact-flag quiet">Low-consequence / assistive</span>}
                {view.use?.peopleAffected.length ? <span className="pill">Affects: {view.use.peopleAffected.join(", ")}</span> : null}
              </div>
            </div>

            <div className="clarity-facts" aria-label="Short answer">
              <div className="clarity-fact"><span>AI's role</span><strong>{aiRole || "Not recorded"}</strong></div>
              <div className="clarity-fact"><span>Human checkpoint</span><strong>{human}</strong></div>
              <div className="clarity-fact"><span>Can AI cause an action by itself?</span><strong>{actionPower}</strong></div>
            </div>
          </section>

          {!canShare ? (
            <div className="notice" style={{ margin: "18px 22px 0" }}>
              This record is still a draft. Public and affected-person views become available once the record is structurally valid.
            </div>
          ) : null}

          <nav className="clarity-path" aria-label="Reading path">
            <button type="button" onClick={() => jumpTo("crux-where")}><span>01</span><strong>Where is AI involved?</strong></button>
            <button type="button" onClick={() => jumpTo("crux-power")}><span>02</span><strong>What power does it have?</strong></button>
            <button type="button" onClick={() => jumpTo("crux-evidence")}><span>03</span><strong>Why should I believe this?</strong></button>
            <button type="button" onClick={() => jumpTo("crux-cases")}><span>04</span><strong>What happened here?</strong></button>
          </nav>

          <details className="advanced-details clarity-record-tools">
            <summary>Record actions</summary>
            <div className="toolbar-group">
              <label className="btn file-label">Open JSON<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label>
              <button className="btn ghost" type="button" onClick={startNew}>New record</button>
              <button
                className="btn"
                type="button"
                disabled={!exportValue}
                onClick={() => exportValue && downloadJson(
                  exportValue,
                  `${baseName}-${effectiveLens === "working" ? "crux" : effectiveLens}.json`,
                )}
              >
                Download {effectiveLens === "working" ? "record" : "this view"}
              </button>
            </div>
          </details>

          <div className="clarity-reading">
            <section className="clarity-section" id="crux-where">
              <QuestionHeading
                number="01"
                title="Where is AI involved?"
                copy="First understand the real-world process. AI should appear as one step in the work, not as the whole story."
              />
              {isFundingExample ? (
                <div className="clarity-teaching">
                  <strong>What to notice</strong>
                  <span>Follow the application from input to outcome. AI appears once: it surfaces possible evidence. The funding officer then reviews the original application before the eligibility decision.</span>
                </div>
              ) : null}
              <div className="story-intro">
                <div>
                  <div className="kicker">The process</div>
                  <h3>{view.version?.processName ?? view.use?.name ?? "Process not yet described"}</h3>
                  <p>{view.system?.description ?? view.use?.summary ?? "No process description is visible."}</p>
                </div>
              </div>
              {view.version?.nodes.length ? (
                <div className="story-flow">
                  {view.version.nodes.map((node, index) => (
                    <div style={{ display: "contents" }} key={node.id}>
                      {index > 0 ? <div className="story-arrow">→</div> : null}
                      <article className={`story-node node-${node.type}`}>
                        <span>{nodeLabels[node.type] ?? node.type}</span>
                        <strong>{node.name}</strong>
                        {node.description ? <small>{node.description}</small> : null}
                      </article>
                    </div>
                  ))}
                </div>
              ) : <div className="clarity-unknown"><strong>The process is not known yet.</strong><p>No process steps are visible in this view.</p></div>}
            </section>

            <section className="clarity-section" id="crux-power">
              <QuestionHeading
                number="02"
                title="What power does it have?"
                copy="The important distinction is what AI can influence or cause, and where human authority sits before something consequential happens."
              />
              <div className="power-grid">
                <article className="mental-card">
                  <div className="kicker">AI can</div>
                  {powerSummary(view.system).map((item) => <div className="power-line" key={item}>{item}</div>)}
                  <div className="divider" />
                  <div className="small muted">Can it cause an action by itself?</div>
                  <div className="power-line">{actionPower}</div>
                </article>
                <article className="mental-card">
                  <div className="kicker">Human authority</div>
                  {view.version?.decisions.length ? view.version.decisions.map((decision) => (
                    <div className="authority-line" key={decision.id}>
                      <strong>{decision.name}</strong>
                      <span>Final authority: {authorityLabel(decision.authority)}</span>
                      <span>{decision.reviewBeforeEffect ? "Human review happens before effect" : "No pre-effect review is recorded"}</span>
                    </div>
                  )) : <div className="clarity-unknown"><strong>Decision authority is not recorded.</strong><p>That may be appropriate for a simple assistive use, or it may be a gap worth resolving.</p></div>}
                </article>
              </div>

              {view.version?.actions.length ? (
                <div className="mental-card" style={{ marginTop: 16 }}>
                  <div className="kicker">Actions connected to this AI use</div>
                  {view.version.actions.map((action) => (
                    <div className="action-boundary" key={action.id}>
                      <div><strong>{action.name}</strong><span>{action.scope}</span></div>
                      <div className="pill-row" style={{ marginTop: 0 }}>
                        <span className="pill">Initiated by {action.initiatedBy}</span>
                        <span className="pill">{action.humanApprovalRequired ? "Human approval required" : "No human approval required"}</span>
                        <span className="pill">Reversible: {action.reversibility}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {effectiveLens === "working" && observed.observationCount > 0 ? (
                <details className="advanced-details">
                  <summary>System-reported activity</summary>
                  <p className="small muted">Runtime observations can show whether the running system differs from the description above. They do not decide whether it is safe or trustworthy.</p>
                  <div className="pill-row">
                    <span className="pill">{observed.observationCount} observation{observed.observationCount === 1 ? "" : "s"}</span>
                    <span className={`pill ${observed.divergenceCount ? "rust" : "moss"}`}>{observed.divergenceCount} difference{observed.divergenceCount === 1 ? "" : "s"} to review</span>
                  </div>
                </details>
              ) : null}
            </section>

            <section className="clarity-section" id="crux-evidence">
              <QuestionHeading
                number="03"
                title="Why should I believe this?"
                copy="Now test the account above. Keep what the organisation says separate from the evidence someone can actually inspect."
              />

              {view.claims.length ? view.claims.map((item) => {
                const linked = view.links
                  .filter((link) => link.claimRef === item.id)
                  .flatMap((link) => {
                    const evidence = view.evidence.find((candidate) => candidate.id === link.evidenceRef);
                    return evidence ? [{ evidence, relationship: link.relationship }] : [];
                  });

                return (
                  <article className="reasoning-stack" key={item.id}>
                    <div className="reasoning-row says-row">
                      <div>
                        <div className="clarity-plain-label"><b>SAYS</b><span>What the organisation says</span></div>
                      </div>
                      <div><strong>{item.statement}</strong></div>
                    </div>
                    {linked.length ? linked.map(({ evidence, relationship }) => (
                      <div className="reasoning-row shows-row" key={evidence.id}>
                        <div>
                          <div className="clarity-plain-label"><b>SHOWS</b><span>Evidence we can inspect</span></div>
                        </div>
                        <div>
                          <strong>{evidence.summary}</strong>
                          <p>{relationshipLabel(relationship)} the statement · {evidenceKindLabel(evidence.kind)}</p>
                          {evidence.limitations.length ? <p className="caution">Limitation: {evidence.limitations.join(" · ")}</p> : null}
                          {evidence.externalRefs[0] ? <a href={evidence.externalRefs[0]} target="_blank" rel="noreferrer">Open source reference ↗</a> : null}
                        </div>
                      </div>
                    )) : (
                      <div className="reasoning-row">
                        <div><span className="pill">Unknown</span></div>
                        <div><strong>No evidence is linked yet.</strong><p>This is still a statement, not evidence. CRUX leaves that gap visible.</p></div>
                      </div>
                    )}
                  </article>
                );
              }) : (
                <div className="clarity-unknown"><strong>No inspectable statement is visible.</strong><p>There is nothing in this view yet to compare with evidence.</p></div>
              )}
            </section>

            <section className="clarity-section" id="crux-cases">
              <QuestionHeading
                number="04"
                title="What happened here?"
                copy="Finally, a particular case is different from the general description above. This is where CRUX shows what AI contributed, who acted and what outcome followed."
              />

              {view.receipts.length ? view.receipts.map((receipt) => (
                <article className="reasoning-stack happened-stack" key={receipt.id}>
                  <div className="reasoning-row happened-row">
                    <div><div className="clarity-plain-label"><b>HAPPENED</b><span>A particular case</span></div></div>
                    <div><strong>{receipt.aiSummary}</strong><p>What AI contributed in this case.</p></div>
                  </div>
                  <div className="case-flow">
                    <div><span>AI</span><strong>{receipt.aiSummary}</strong></div>
                    <b>→</b>
                    <div><span>Next</span><strong>{receipt.effectOfAi}</strong></div>
                    <b>→</b>
                    <div><span>Person</span><strong>{receipt.humanInvolvement ?? "No human involvement recorded"}</strong></div>
                    <b>→</b>
                    <div><span>Outcome</span><strong>{receipt.outcome}</strong></div>
                  </div>
                  <div className="case-footer">
                    <span><strong>Final authority:</strong> {authorityLabel(receipt.finalAuthority)}</span>
                    <span><strong>Challenge:</strong> {receipt.challenge?.available ? receipt.challenge.description ?? receipt.challenge.uri ?? "Available" : "No challenge route recorded"}</span>
                  </div>
                </article>
              )) : view.use?.consequential ? (
                <div className="clarity-unknown"><strong>No particular case is visible yet.</strong><p>The general process can still be understood, but there is no case here showing what happened in practice.</p></div>
              ) : (
                <div className="mental-card">
                  <div className="kicker">Proportionate by default</div>
                  <h3>A case record is not necessary for every ordinary AI use.</h3>
                  <p className="small muted">For a low-consequence assistive use, CRUX can stop with a clear description of the process, power and relevant evidence. A specific case becomes useful when consequence, dispute, incident or learning makes it worth inspecting.</p>
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="clarity-edit-shell">
          <div className="clarity-edit-top">
            <div>
              <div className="kicker">Editing internal record</div>
              <strong>{bundle.organisations[0]?.name ?? "Your organisation"}{use ? ` · ${use.name}` : ""}</strong>
              <div className="clarity-mode-note">Describe the use in ordinary language. CRUX keeps the richer schema underneath and only asks for more detail when consequence or agency makes it useful.</div>
            </div>
            {bundle.ai_uses.length > 1 ? (
              <select className="select compact-select" value={use?.id ?? ""} onChange={(event) => setSelectedUseId(event.target.value)}>
                {bundle.ai_uses.map((item) => <option value={item.id} key={item.id}>{item.name || "Untitled AI use"}</option>)}
              </select>
            ) : null}
          </div>

          <EditPanel
            bundle={bundle}
            use={use}
            system={system}
            versionId={version?.id}
            claim={claim}
            onMutate={mutate}
            onUseChange={updateUse}
            onSystemChange={updateSystem}
            onToggleInfluence={toggleInfluence}
            onBundleChange={(next) => {
              setBundle(next);
              setActiveExample(null);
            }}
            onAddUse={addUse}
            onRead={() => setMode("read")}
          />

          <details className="advanced-details clarity-record-tools" style={{ marginTop: 28 }}>
            <summary>Record actions</summary>
            <div className="toolbar-group">
              <label className="btn file-label">Open JSON<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label>
              <button className="btn ghost" type="button" onClick={startNew}>Reset to a new record</button>
              <button className="btn" type="button" disabled={!canonical} onClick={() => canonical && downloadJson(canonical, `${baseName}-crux.json`)}>Download record</button>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function EditPanel({
  bundle,
  use,
  system,
  versionId,
  claim,
  onMutate,
  onUseChange,
  onSystemChange,
  onToggleInfluence,
  onBundleChange,
  onAddUse,
  onRead,
}: {
  bundle: CruxPortableBundle;
  use: CruxPortableBundle["ai_uses"][number] | undefined;
  system: CruxPortableBundle["systems"][number] | undefined;
  versionId: string | undefined;
  claim: CruxPortableBundle["claims"][number] | undefined;
  onMutate: (change: (next: CruxPortableBundle) => void) => void;
  onUseChange: (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => void;
  onSystemChange: (patch: Partial<CruxPortableBundle["systems"][number]>) => void;
  onToggleInfluence: (value: AIInfluence, checked: boolean) => void;
  onBundleChange: (bundle: CruxPortableBundle) => void;
  onAddUse: () => void;
  onRead: () => void;
}) {
  const organisation = bundle.organisations[0];
  if (!organisation || !use || !system) return <div className="empty">This record can be read, but the guided editor cannot edit this shape yet.</div>;

  return (
    <div className="guided-thinking">
      <div className="guided-intro">
        <div className="kicker">Describe one real use of AI</div>
        <h2>Start with the work, not the technology.</h2>
        <p>The four questions structure authoring too, but extra governance detail appears only when the use can materially affect people or cause actions.</p>
      </div>

      <section className="thinking-step">
        <StepNumber number="01" title="Where is AI involved?" />
        <Guidance title="Example">“AI reads a funding application and highlights evidence that might relate to eligibility criteria.”</Guidance>
        <Field label="Organisation" id="organisation-name"><input id="organisation-name" className="input" value={organisation.name} onChange={(event) => onMutate((next) => { if (next.organisations[0]) next.organisations[0].name = event.target.value; })} /></Field>
        <Field label="Name this use" id="use-name"><input id="use-name" className="input" value={use.name} onChange={(event) => onUseChange({ name: event.target.value })} /></Field>
        <Field label="What are you trying to do?" id="purpose"><textarea id="purpose" className="textarea" value={use.purpose} onChange={(event) => onUseChange({ purpose: event.target.value })} /></Field>
        <Field label="Explain it simply for someone outside your organisation" id="public-summary"><textarea id="public-summary" className="textarea" value={use.public_summary ?? ""} onChange={(event) => onUseChange({ public_summary: event.target.value })} /></Field>
        <Field label="What does AI do in this process?" id="system-description"><textarea id="system-description" className="textarea" value={system.description} onChange={(event) => onSystemChange({ description: event.target.value })} /></Field>
      </section>

      <section className="thinking-step">
        <StepNumber number="02" title="What power does it have?" />
        <Guidance title="Why we ask">The key distinction is whether AI only helps someone think, or whether it can decide or cause something to happen.</Guidance>
        <div className="choice-grid">
          {influenceChoices.map((choice) => (
            <label className="choice-card" key={choice.value}>
              <input type="checkbox" checked={system.influence.includes(choice.value)} onChange={(event) => onToggleInfluence(choice.value, event.target.checked)} />
              <span><strong>{choice.label}</strong><small>{choice.help}</small></span>
            </label>
          ))}
        </div>
        <Field label="Can AI cause an action?" id="agency">
          <select id="agency" className="select" value={system.agency} onChange={(event) => onSystemChange({ agency: event.target.value as AIAgency })}>
            {agencyChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </Field>
        <label className="checkbox-line consequence-check">
          <input type="checkbox" checked={use.consequential} onChange={(event) => onUseChange({ consequential: event.target.checked })} />
          <span><strong>This use can materially affect someone.</strong><small>For example their eligibility, access to a service, opportunity, rights, money or treatment.</small></span>
        </label>
        {versionId && (use.consequential || system.agency !== "none") ? (
          <div className="progressive-detail">
            <div className="kicker">Because this matters, a few more questions</div>
            <h3>Who decides, and what can actually happen?</h3>
            <AuthorityEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
          </div>
        ) : (
          <div className="proportionate-stop">For straightforward assistive use, this can stay lightweight. You do not need to model a complex governance workflow that does not exist.</div>
        )}
      </section>

      <section className="thinking-step">
        <StepNumber number="03" title="Why should someone believe this?" />
        <Guidance title="SAYS → SHOWS">Write what the organisation says is true. Add evidence separately. A statement with no evidence is allowed to stay a statement.</Guidance>
        {claim ? (
          <>
            <Field label="What are you saying is true?" id="claim"><textarea id="claim" className="textarea" value={claim.statement} onChange={(event) => onMutate((next) => { const target = next.claims.find((item) => item.id === claim.id); if (target) target.statement = event.target.value; })} /></Field>
            <EvidenceEditor bundle={bundle} claimId={claim.id} onBundleChange={onBundleChange} />
          </>
        ) : <div className="notice">This imported use has no directly scoped statement. CRUX will not invent one silently.</div>}
      </section>

      {use.consequential && versionId ? (
        <section className="thinking-step">
          <StepNumber number="04" title="What happened here?" />
          <Guidance title="Only for particular cases">This is not another policy statement. Record a specific consequential case so someone can see what AI contributed, who decided and what outcome followed.</Guidance>
          <ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
        </section>
      ) : null}

      <div className="guided-actions">
        <button className="btn" type="button" onClick={onAddUse}>+ Add another AI use</button>
        <button className="btn primary" type="button" onClick={onRead}>See how this reads</button>
      </div>
    </div>
  );
}

function QuestionHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return <header className="question-heading"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></header>;
}

function StepNumber({ number, title }: { number: string; title: string }) {
  return <div className="step-number"><span>{number}</span><h3>{title}</h3></div>;
}

function Guidance({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="guidance"><strong>{title}</strong><span>{children}</span></div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}
