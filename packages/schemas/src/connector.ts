import { z } from "zod";
import { DiscoverySourceKindSchema } from "./discovery.js";

export const ConnectorConnectionModeSchema = z.enum([
  "github_app",
  "oauth",
  "api_key",
  "upload",
  "local",
  "webhook",
  "generated_patch",
]);
export type ConnectorConnectionMode = z.infer<typeof ConnectorConnectionModeSchema>;

export const ConnectorCapabilitySchema = z.enum([
  "discover_source",
  "discover_runtime",
  "discover_workflow",
  "observe_runtime",
  "install_observer",
]);
export type ConnectorCapability = z.infer<typeof ConnectorCapabilitySchema>;

export const ConnectorContentBoundarySchema = z.enum([
  "metadata_only",
  "source_readonly",
  "local_processing",
]);
export type ConnectorContentBoundary = z.infer<typeof ConnectorContentBoundarySchema>;

export const DiscoveryConnectorSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  source_kinds: z.array(DiscoverySourceKindSchema).min(1),
  connection_modes: z.array(ConnectorConnectionModeSchema).min(1),
  capabilities: z.array(ConnectorCapabilitySchema).min(1),
  content_boundary: ConnectorContentBoundarySchema,
  maturity: z.enum(["prototype", "planned"]),
}).strict();
export type DiscoveryConnector = z.infer<typeof DiscoveryConnectorSchema>;
