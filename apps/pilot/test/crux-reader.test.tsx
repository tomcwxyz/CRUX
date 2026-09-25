import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePortableBundle, redactBundle } from "@crux/formats";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import { CruxReader } from "../components/crux-reader";
import { buildReaderModel } from "../lib/reader-model";

const funding = parsePortableBundle(fundingReviewJson as unknown);
const render = (element: React.ReactElement) => renderToStaticMarkup(element);

describe("CruxReader", () => {
  it("reads the public view as SAYS before SHOWS without internal purpose text", () => {
    const html = render(<CruxReader model={buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") })} />);
    expect(html.indexOf(">SAYS<")).toBeGreaterThan(-1);
    expect(html.indexOf(">SAYS<")).toBeLessThan(html.indexOf(">SHOWS<"));
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
    expect(html).toContain("AI stops here");
    expect(html).toContain("Specific cases are explained only to the people they affect.");
  });

  it("puts the case first for the affected person", () => {
    const html = render(<CruxReader model={buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "affected_party") })} />);
    expect(html).toContain(">HAPPENED<");
    expect(html.indexOf("What happened here?")).toBeLessThan(html.indexOf("Where is AI involved?"));
    expect(html).toContain("About the wider AI process");
    expect(html).not.toContain(funding.ai_uses[0]!.purpose);
    expect(html).not.toContain("System-reported activity");
  });

  it("disables audiences that are not available, such as for an invalid draft", () => {
    const html = render(
      <CruxReader
        model={buildReaderModel({ kind: "working", bundle: funding })}
        onAudienceChange={() => undefined}
        availableAudiences={["internal"]}
      />,
    );
    expect(html.match(/<button[^>]*disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-pressed="true"');
  });

  it("hides the audience switch when the page provides its own tabs", () => {
    const html = render(<CruxReader model={buildReaderModel({ kind: "working", bundle: funding })} />);
    expect(html).not.toContain("aria-pressed");
  });

  it("says when the selected use is not disclosed instead of showing another", () => {
    const model = buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") }, "ai-use:not-here");
    expect(render(<CruxReader model={model} />)).toContain("This AI use is not included in the public view.");
  });

  it("shows runtime activity only to the internal audience", () => {
    expect(render(<CruxReader model={buildReaderModel({ kind: "working", bundle: funding })} />)).toContain("System-reported activity");
    expect(render(<CruxReader model={buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") })} />)).not.toContain("System-reported activity");
  });
});
