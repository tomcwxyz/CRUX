import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parsePortableBundle, redactBundle } from "@crux/formats";
import observedJson from "../../../examples/observed-divergence/crux.json";
import fundingJson from "../../../examples/funding-review/crux.json";
import { buildReaderModel } from "../lib/reader-model";
import { SimpleUseCard } from "../components/simple-use-card";

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

describe("simple AI use card", () => {
  it("shows the explanation before the detailed disclosure", () => {
    const bundle = parsePortableBundle(fundingJson as unknown);
    const html = render(<SimpleUseCard model={buildReaderModel({ kind: "working", bundle })} />);
    expect(html).toContain("What AI does");
    expect(html).toContain("Who decides");
    expect(html).toContain("How do we know?");
    expect(html).toContain("What&#x27;s actually happening?");
    expect(html).toContain("See the full explanation and evidence");
  });

  it("never leaks internal runtime observations to public readers", () => {
    const bundle = parsePortableBundle(observedJson as unknown);
    const internal = render(<SimpleUseCard model={buildReaderModel({ kind: "working", bundle })} />);
    const publicHtml = render(<SimpleUseCard model={buildReaderModel({
      kind: "disclosure", projection: redactBundle(bundle, "public"),
    })} />);
    expect(internal).toContain("What&#x27;s actually happening?");
    expect(publicHtml).not.toContain("What&#x27;s actually happening?");
    expect(publicHtml).not.toContain("Working record");
    expect(publicHtml).not.toContain(bundle.ai_uses[0]!.purpose);
  });

  it("does not imply a fresh authoring draft has been verified by runtime", () => {
    const bundle = parsePortableBundle(fundingJson as unknown);
    bundle.runs = [];
    bundle.events = [];
    bundle.observations = [];
    const html = render(<SimpleUseCard model={buildReaderModel({ kind: "working", bundle })} />);
    expect(html).toContain("Not connected");
    expect(html).toContain("That doesn&#x27;t mean the system has never run.");
  });
});
