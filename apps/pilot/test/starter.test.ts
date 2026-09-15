import { describe, expect, it } from "vitest";
import {
  parsePortableBundle,
  portableBundleSchema,
  validateBundleReferences,
} from "@crux/formats";
import { createStarterBundle } from "../lib/starter";

describe("pilot starter bundle", () => {
  it("is a valid canonical CRUX bundle", () => {
    const bundle = parsePortableBundle(createStarterBundle("2026-09-15T11:30:00+00:00"));
    expect(validateBundleReferences(bundle)).toEqual({ valid: true, issues: [] });
  });

  it("starts with an explicitly unevidenced declaration", () => {
    const bundle = createStarterBundle("2026-09-15T11:30:00+00:00");
    expect(bundle.claims).toHaveLength(1);
    expect(bundle.evidence).toHaveLength(0);
    expect(bundle.evidence_links).toHaveLength(0);
  });

  it("treats incomplete edits as draft-invalid rather than canonical", () => {
    const bundle = createStarterBundle("2026-09-15T11:30:00+00:00");
    const [organisation] = bundle.organisations;
    expect(organisation).toBeDefined();
    if (organisation) organisation.name = "";

    const result = portableBundleSchema.safeParse(bundle);
    expect(result.success).toBe(false);
  });
});
