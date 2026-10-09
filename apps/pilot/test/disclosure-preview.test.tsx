import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePortableBundle } from "@crux/formats";
import fundingJson from "../../../examples/funding-review/crux.json";
import { DisclosurePreview } from "../components/disclosure-preview";
import { EvidenceEditor } from "../components/evidence-editor";

const funding = parsePortableBundle(fundingJson as unknown);

describe("evidence and disclosure reading", () => {
  it("starts manual evidence with two questions and internal visibility", () => {
    const html = renderToStaticMarkup(
      <EvidenceEditor bundle={funding} claimId={funding.claims[0]!.id} onBundleChange={() => undefined} />,
    );
    expect(html).toContain("What did you check or find?");
    expect(html).toContain("Does it support what you");
    expect(html).toContain("Add source, limitations or sharing details");
    expect(html).toContain('value="internal" selected=""');
    expect(html).toContain("not independently verified");
  });

  it("previews public disclosure without falling back to private purpose", () => {
    const html = renderToStaticMarkup(<DisclosurePreview bundle={funding} />);
    expect(html).toContain("Someone from the public");
    expect(html).toContain("Someone affected by a decision");
    expect(html).toContain("Public explanation");
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
    expect(html).not.toContain("What's actually happening?");
  });

  it("places the particular case up front for the affected person", () => {
    const html = renderToStaticMarkup(
      <DisclosurePreview bundle={funding} defaultAudience="affected_party" />,
    );
    expect(html).toContain("Explanation for someone affected");
    expect(html).toContain("HAPPENED");
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
  });
});
