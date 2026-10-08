import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveRuntimeWorkbench } from "../components/live-runtime-workbench";

describe("runtime demo first impression", () => {
  it("starts with the human story and names the synthetic nature clearly", () => {
    const html = renderToStaticMarkup(<LiveRuntimeWorkbench />);
    expect(html).toContain("Fictional example");
    expect(html).toContain("AI helps review an application");
    expect(html).toContain("Inside the organisation");
    expect(html).toContain("What the public sees");
    expect(html).toContain("What an applicant sees");
    expect(html).toContain("Opening the example");
    expect(html).not.toContain("revision 0");
    expect(html).not.toContain("No process description is available");
  });
});
