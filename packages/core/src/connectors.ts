import { DiscoveryConnectorSchema, type DiscoveryConnector } from "@crux/schemas";

const define = (connector: DiscoveryConnector) => DiscoveryConnectorSchema.parse(connector);

export const discoveryConnectors: DiscoveryConnector[] = [
  define({
    id: "github-ship-check",
    name: "GitHub project",
    description: "Use Ship Check to find AI SDKs, providers and workflow boundaries without sending prompts or application records to CRUX.",
    source_kinds: ["source_code"],
    connection_modes: ["github_app", "generated_patch"],
    capabilities: ["discover_source", "install_observer"],
    content_boundary: "source_readonly",
    maturity: "prototype",
  }),
  define({
    id: "public-git-repository",
    name: "Public Git repository",
    description: "Read a bounded source snapshot from GitLab, Framagit, Forgejo/Codeberg, Gitea or Bitbucket without requiring a GitHub account.",
    source_kinds: ["source_code"],
    connection_modes: ["public_url"],
    capabilities: ["discover_source"],
    content_boundary: "source_readonly",
    maturity: "prototype",
  }),
  define({
    id: "project-zip",
    name: "Project ZIP",
    description: "Inspect an exported project locally or transiently when there is no GitHub connection.",
    source_kinds: ["source_code"],
    connection_modes: ["upload", "local"],
    capabilities: ["discover_source"],
    content_boundary: "local_processing",
    maturity: "planned",
  }),
  define({
    id: "ai-gateway",
    name: "AI gateway",
    description: "Discover and observe model/provider activity at the boundary applications already use.",
    source_kinds: ["gateway", "runtime"],
    connection_modes: ["oauth", "api_key"],
    capabilities: ["discover_runtime", "observe_runtime"],
    content_boundary: "metadata_only",
    maturity: "planned",
  }),
  define({
    id: "saas-export",
    name: "SaaS evidence export",
    description: "Inspect selected Copilot, Gemini and Agentforce AI audit exports locally. Airtable, Plinth and ordinary workflow records remain context only, not AI observations.",
    source_kinds: ["platform", "runtime"],
    connection_modes: ["upload"],
    capabilities: ["discover_runtime"],
    content_boundary: "local_processing",
    maturity: "prototype",
  }),
  define({
    id: "workflow-platform",
    name: "Workflow platform",
    description: "Inspect workflow structure and, where supported, observe executions from tools such as n8n, Make or Zapier.",
    source_kinds: ["workflow_export", "platform", "runtime"],
    connection_modes: ["oauth", "api_key", "webhook", "upload"],
    capabilities: ["discover_workflow", "observe_runtime", "install_observer"],
    content_boundary: "metadata_only",
    maturity: "planned",
  }),
];

export const connectorForSourceKind = (kind: DiscoveryConnector["source_kinds"][number]) =>
  discoveryConnectors.filter((connector) => connector.source_kinds.includes(kind));
