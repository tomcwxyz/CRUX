#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { ZodError } from "zod";
import {
  importEvidenceEnvelope,
  inspectBundle,
  parsePortableBundle,
  portableBundleJsonSchema,
  redactBundle,
  validateBundleReferences,
} from "@crux/formats";
import type { DisclosureLevel } from "@crux/schemas";

const usage = `CRUX — open evidence and provenance for organisational AI

Usage:
  crux validate <bundle.json>
  crux inspect <bundle.json> [--as-of <iso-timestamp>]
  crux redact <bundle.json> --level <public|affected_party|trusted|internal> [-o <file>]
  crux ingest-evidence <bundle.json> <envelope.json> [-o <file>]
  crux schema [-o <file>]
`;

const option = (args: string[], names: string[]): string | undefined => {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
  }
  return undefined;
};

const readJson = async (path: string): Promise<unknown> => {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
};

const readBundle = async (path: string) => parsePortableBundle(await readJson(path));

const writeOrPrint = async (value: unknown, output?: string) => {
  const serialised = `${JSON.stringify(value, null, 2)}\n`;
  if (output) {
    await writeFile(output, serialised, "utf8");
    process.stdout.write(`${output}\n`);
  } else {
    process.stdout.write(serialised);
  }
};

const parseDisclosureLevel = (value: string | undefined): DisclosureLevel => {
  if (
    value === "public" ||
    value === "affected_party" ||
    value === "trusted" ||
    value === "internal"
  ) {
    return value;
  }
  throw new Error(
    "--level must be one of public, affected_party, trusted or internal.",
  );
};

const formatZodError = (error: ZodError) =>
  error.issues
    .map((issue) => `${issue.path.join(".") || "bundle"}: ${issue.message}`)
    .join("\n");

const main = async () => {
  const args = process.argv.slice(2);
  const [command, file] = args;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage);
    return;
  }

  if (command === "schema") {
    await writeOrPrint(portableBundleJsonSchema, option(args, ["-o", "--output"]));
    return;
  }

  if (!file) throw new Error(`${command} requires a bundle path.\n\n${usage}`);

  const bundle = await readBundle(file);

  if (command === "validate") {
    const validation = validateBundleReferences(bundle);
    if (!validation.valid) {
      for (const issue of validation.issues) {
        process.stderr.write(`${issue.path}: ${issue.message}\n`);
      }
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`Valid CRUX bundle: ${file}\n`);
    return;
  }

  if (command === "inspect") {
    const inspection = inspectBundle(bundle, option(args, ["--as-of"]));
    process.stdout.write(`${inspection.summary}\n`);
    return;
  }

  if (command === "redact") {
    const level = parseDisclosureLevel(option(args, ["--level"]));
    const projected = redactBundle(bundle, level);
    await writeOrPrint(projected, option(args, ["-o", "--output"]));
    return;
  }

  if (command === "ingest-evidence") {
    const envelopePath = args[2];
    if (!envelopePath || envelopePath.startsWith("-")) {
      throw new Error(`ingest-evidence requires an EvidenceEnvelope path.\n\n${usage}`);
    }

    const result = importEvidenceEnvelope(bundle, await readJson(envelopePath));
    await writeOrPrint(result.bundle, option(args, ["-o", "--output"]));
    process.stderr.write(`Evidence ${result.evidence.id}: ${result.status}\n`);
    return;
  }

  throw new Error(`Unknown command ${command}.\n\n${usage}`);
};

main().catch((error: unknown) => {
  if (error instanceof ZodError) {
    process.stderr.write(`Invalid CRUX structure:\n${formatZodError(error)}\n`);
  } else if (error instanceof SyntaxError) {
    process.stderr.write(`Invalid JSON: ${error.message}\n`);
  } else if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write("Unknown CRUX CLI error.\n");
  }
  process.exitCode = 1;
});