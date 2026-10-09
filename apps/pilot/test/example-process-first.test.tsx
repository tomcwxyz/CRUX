import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePortableBundle, redactBundle } from "@crux/formats";
import fundingJson from "../../../examples/funding-review/crux.json";
import ExamplesPage from "../app/examples/page";
import { SimpleExamples } from "../components/simple-examples";
import { ProcessFlow } from "../components/process-flow";
import { SimpleUseCard } from "../components/simple-use-card";
import { buildReaderModel } from "../lib/reader-model";

const funding = parsePortableBundle(fundingJson as unknown);
const publicModel = buildReaderModel({
  kind: "disclosure", projection: redactBundle(funding, "public"),
}, funding.ai_uses[0]!.id);

describe("process-first CRUX example", () => {
  it("introduces the flow instead of a dense evidence card", () => {
    const html = renderToStaticMarkup(<ExamplesPage />);
    expect(html).toContain("Where does AI fit in?");
    expect(html).toContain("Start with the process.");
    expect(html).not.toContain("What would someone need to know?");
    expect(html).toContain('href="/author"');
  });

  it("shows example and audience choices, the real process, and key facts before evidence", () => {
    const html = renderToStaticMarkup(<SimpleExamples />);
    expect(html).toContain('aria-label="Choose example"');
    expect(html).toContain('aria-label="Who is reading?"');
    expect(html).toContain("The process at a glance");
    expect(html).toContain("AI stops here");
    expect(html).toContain("What AI does");
    expect(html).toContain("Who decides or acts");
    expect(html).toContain("What follows");
    expect(html.indexOf("How the work happens")).toBeLessThan(html.indexOf("Who decides or acts"));
    expect(html.indexOf("Who decides or acts")).toBeLessThan(html.indexOf("Explore the evidence and questions"));
    expect(html).toMatch(/<details(?![^>]*\bopen=)[^>]*>/);
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
    expect(html).not.toContain("System-reported activity");
  });

  it("only labels the boundary when the next recorded step is a person", () => {
    const steps = publicModel.process!.steps;
    const html = renderToStaticMarkup(<ProcessFlow steps={steps} prominent />);
    expect(html).toContain("How the work happens");
    expect(html).toContain("AI stops here");
    expect((html.match(/AI stops here/g) ?? [])).toHaveLength(1);
    const noHandoff = steps.map((step) => ({ ...step, aiStopsBefore: false }));
    expect(renderToStaticMarkup(<ProcessFlow steps={noHandoff} />)).not.toContain("AI stops here");
  });

  it("keeps evidence visible in the secondary explanation without repeating the hero", () => {
    const html = renderToStaticMarkup(<SimpleUseCard model={publicModel} showOverview={false} />);
    expect(html).toContain("How do we know?");
    expect(html).toContain("SAYS");
    expect(html).toContain("SHOWS");
    expect(html).toContain("See the full explanation and evidence");
    expect(html).not.toContain("<h2>Funding review</h2>");
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
  });
});
