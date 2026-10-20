import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverLocalSource } from "../src/discover-source.js";

const tempDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("local Git-independent discovery", () => {
  it("discovers runtime call sites without GitHub or any network credentials", async () => {
    const root = await mkdtemp(join(tmpdir(), "crux-source-"));
    tempDirectories.push(root);
    await mkdir(join(root, "src", "ask"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "package.json"), '{"dependencies":{"ai":"^7"}}');
    await writeFile(join(root, "src", "ask", "route.ts"), "export const go = () => streamText({ model, prompt });");
    await writeFile(join(root, "docs", "secret.ts"), "streamText({ password: 'not to collect' });");

    const { report, scan } = await discoverLocalSource(root, "framagit-checkout");
    expect(scan.files_read).toBe(2);
    expect(report.source.provider).toBe("framagit-checkout");
    expect(report.signals.some((signal) => signal.kind === "model_call")).toBe(true);
    expect(report.signals.every((signal) =>
      signal.evidence.every((item) => !item.path?.startsWith("docs")),
    )).toBe(true);
  });
});
