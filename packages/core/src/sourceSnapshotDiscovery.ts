import {
  DiscoveryReportSchema,
  type DiscoveryReport,
  type DiscoverySignal,
} from "@crux/schemas";

export type SourceSnapshotFile = {
  path: string;
  content: string;
};

export type SourceSnapshotInput = {
  provider: string;
  label: string;
  externalRef?: string;
  generatedAt?: string;
  files: SourceSnapshotFile[];
};

const sourceFile = /\.(?:[cm]?[jt]sx?|py|json|ya?ml)$/i;
const dependencyManifest = /(?:^|\/)(?:pyproject\.toml|requirements(?:-[^/]+)?\.txt)$/i;
const excludedFile = /(?:^|\/)(?:docs?|tests?|__tests__|fixtures?|coverage|dist|build|node_modules)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/i;

const callPatterns: Array<{ regex: RegExp; label: string; technology: string }> = [
  { regex: /\bgenerateText\s*\(\s*\{/, label: "Vercel AI SDK text generation", technology: "ai" },
  { regex: /\bgenerateObject\s*\(\s*\{/, label: "Vercel AI SDK structured generation", technology: "ai" },
  { regex: /\bstreamText\s*\(\s*\{/, label: "Vercel AI SDK streaming generation", technology: "ai" },
  { regex: /\.chat\.completions\.create\s*\(/, label: "OpenAI-compatible chat completion", technology: "openai-compatible" },
  { regex: /\.responses\.create\s*\(/, label: "OpenAI responses call", technology: "openai" },
  { regex: /\.messages\.create\s*\(/, label: "Anthropic messages call", technology: "anthropic" },
  { regex: /\.llm\.generateStructured\s*\(/, label: "Structured generation through the project LLM provider", technology: "llm-provider" },
  { regex: /\.llm\.generateText\s*\(/, label: "Text generation through the project LLM provider", technology: "llm-provider" },
];

const lineNumber = (text: string, offset: number) => text.slice(0, offset).split("\n").length;

const shortHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const idFor = (kind: string, file: string, line = 0) =>
  `signal:${kind}:${shortHash(`${file}:${line}`)}`;

const titleFromSlug = (value: string) =>
  value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

const pathWorkflow = (path: string) => {
  const route = path.match(/(?:^|\/)app\/api\/(.+)\/route\.[cm]?[jt]sx?$/i);
  if (route?.[1]) {
    const segments = route[1].split("/").filter((segment) => !segment.startsWith("["));
    if (segments.length > 0) {
      const raw = segments.join(".");
      return { hint: raw.replaceAll("-", "."), label: titleFromSlug(segments.join(" ")) };
    }
  }

  const semanticSegments = new Set([
    "ask", "chat", "agent", "extract", "extraction", "search",
    "summarize", "summarise", "classify", "recommend", "recommendation", "review",
  ]);
  const segments = path
    .split("/")
    .map((segment) => segment.replace(/\.[^.]+$/, "").toLowerCase());
  const semantic = segments.find((segment) => semanticSegments.has(segment));
  return semantic ? { hint: semantic, label: titleFromSlug(semantic) } : null;
};

const namedWorkflow = (path: string, content: string) => {
  const explicit = /\b([a-z][a-z0-9_-]*\.(?:extract|generate|summari[sz]e|classify|review|search|draft|recommend|analyse|analyze))\b/i.exec(content);
  if (explicit?.[1]) {
    return {
      hint: explicit[1],
      label: titleFromSlug(explicit[1].split(".").reverse().join(" ")),
      offset: explicit.index,
    };
  }
  const hasAIBoundary =
    /\bgenerate(?:Text|Object)\s*\(\s*\{|\bstreamText\s*\(\s*\{|\.(?:messages|responses)\.create\s*\(|\.chat\.completions\.create\s*\(|\.llm\.generate(?:Structured|Text)\s*\(|(?:from\s+(?:anthropic|openai)\s+import\b|import\s+(?:anthropic|openai)\b)/i.test(content);
  const route = hasAIBoundary ? pathWorkflow(path) : null;
  return route ? { ...route, offset: 0 } : null;
};

const coalesce = (signals: DiscoverySignal[]) => {
  const grouped = new Map<string, DiscoverySignal>();
  for (const signal of signals) {
    const key = [
      signal.kind,
      signal.label,
      signal.technology ?? "",
      signal.workflow_hint ?? "",
      signal.candidate_label ?? "",
      signal.scope_hint ?? "",
    ].join("|");
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, structuredClone(signal));
      continue;
    }
    const seen = new Set(existing.evidence.map((item) => `${item.path ?? ""}:${item.line ?? 0}`));
    for (const evidence of signal.evidence) {
      const evidenceKey = `${evidence.path ?? ""}:${evidence.line ?? 0}`;
      if (!seen.has(evidenceKey) && existing.evidence.length < 5) {
        existing.evidence.push(evidence);
        seen.add(evidenceKey);
      }
    }
  }
  return [...grouped.values()];
};

export const discoverAIFromSourceSnapshot = (input: SourceSnapshotInput): DiscoveryReport => {
  const signals: DiscoverySignal[] = [];
  const files = input.files.filter((file) => (sourceFile.test(file.path) || dependencyManifest.test(file.path)) && !excludedFile.test(file.path));
  const packageFile = files.find((file) => file.path === "package.json");

  if (packageFile) {
    const dependencies = [
      { token: '"ai"', label: "Vercel AI SDK dependency", technology: "ai" },
      { token: '"@ai-sdk/openai-compatible"', label: "OpenAI-compatible AI SDK adapter", technology: "openai-compatible" },
      { token: '"openai"', label: "OpenAI SDK dependency", technology: "openai" },
      { token: '"@anthropic-ai/sdk"', label: "Anthropic SDK dependency", technology: "anthropic" },
      { token: '"@google/generative-ai"', label: "Google Generative AI dependency", technology: "google" },
    ];
    for (const dependency of dependencies) {
      const offset = packageFile.content.indexOf(dependency.token);
      if (offset < 0) continue;
      const line = lineNumber(packageFile.content, offset);
      signals.push({
        id: idFor("ai-sdk", packageFile.path, line),
        kind: "ai_sdk",
        label: dependency.label,
        confidence: "high",
        technology: dependency.technology,
        scope_hint: "shared",
        evidence: [{ path: packageFile.path, line, detail: `${dependency.label} is declared in project dependencies.` }],
      });
    }
  }

  for (const file of files) {
    const workflow = namedWorkflow(file.path, file.content);
    if (workflow) {
      const line = lineNumber(file.content, workflow.offset);
      signals.push({
        id: idFor("workflow", file.path, line),
        kind: "workflow_job",
        label: workflow.hint,
        confidence: "high",
        workflow_hint: workflow.hint,
        candidate_label: workflow.label,
        scope_hint: "use",
        evidence: [{ path: file.path, line, detail: `A bounded workflow boundary ${workflow.hint} is present in source evidence.` }],
      });
    }

    const provider = /\b(?:interface\s+LlmProvider|LLM_PROVIDER|createOpenAICompatLlm)\b/.exec(file.content);
    if (provider) {
      const line = lineNumber(file.content, provider.index);
      signals.push({
        id: idFor("provider", file.path, line),
        kind: "provider_configuration",
        label: "Configurable LLM provider boundary",
        confidence: "high",
        scope_hint: "shared",
        evidence: [{ path: file.path, line, detail: "Source contains a configurable LLM/provider boundary." }],
      });
    }

    const sdkProvider = /(?:from\s+(anthropic|openai)\s+import\b|import\s+(anthropic|openai)\b)/i.exec(file.content);
    if (sdkProvider) {
      const technology = (sdkProvider[1] ?? sdkProvider[2] ?? "ai-provider").toLowerCase();
      const line = lineNumber(file.content, sdkProvider.index);
      signals.push({
        id: idFor("ai-provider", file.path, line),
        kind: "ai_provider",
        label: `${titleFromSlug(technology)} SDK`,
        confidence: "high",
        technology,
        ...(workflow
          ? { workflow_hint: workflow.hint, candidate_label: workflow.label, scope_hint: "use" as const }
          : { scope_hint: "shared" as const }),
        evidence: [{ path: file.path, line, detail: `${titleFromSlug(technology)} SDK import detected.` }],
      });
    }

    for (const pattern of callPatterns) {
      const match = pattern.regex.exec(file.content);
      if (!match) continue;
      const line = lineNumber(file.content, match.index);
      const shared = /(?:^|\/)providers?(?:\/|$)/i.test(file.path) && !workflow;
      signals.push({
        id: idFor("model-call", file.path, line),
        kind: "model_call",
        label: pattern.label,
        confidence: "high",
        technology: pattern.technology,
        ...(workflow
          ? {
              workflow_hint: workflow.hint,
              candidate_label: workflow.label,
              scope_hint: "use" as const,
            }
          : { scope_hint: shared ? ("shared" as const) : ("use" as const) }),
        evidence: [{ path: file.path, line, detail: `${pattern.label} call site detected. Prompt and response content are not included.` }],
      });
    }

    const review = /\b(?:human[_ -]?review|reviewBeforeEffect|approve[A-Z_ -]?|reviewRecommendation)\b/i.exec(file.content);
    if (review) {
      const line = lineNumber(file.content, review.index);
      signals.push({
        id: idFor("human-review", file.path, line),
        kind: "human_review_surface",
        label: "Human review surface",
        confidence: "medium",
        ...(workflow ? { workflow_hint: workflow.hint, candidate_label: workflow.label } : {}),
        evidence: [{ path: file.path, line, detail: "Source contains an explicit human-review or approval marker." }],
      });
    }
  }

  return DiscoveryReportSchema.parse({
    format: "crux-discovery/0.1",
    generated_at: input.generatedAt ?? new Date().toISOString(),
    source: {
      kind: "source_code",
      provider: input.provider,
      label: input.label,
      ...(input.externalRef ? { external_ref: input.externalRef } : {}),
    },
    signals: coalesce(signals).slice(0, 24),
    limitations: [
      "This hosted probe reads a bounded subset of public source/config files. Ship Check remains the deeper local/project scanner.",
      "Static source inspection cannot establish organisational purpose, affected people, decision authority or whether a candidate represents one coherent AI use.",
      "No prompt, response, source-document or application-record content is included.",
      "Absence of a discovery signal does not establish absence of AI use.",
    ],
  });
};
