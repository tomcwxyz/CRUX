import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "../app/page";
import { SimpleAIUseWorkbench } from "../components/simple-ai-use-workbench";

describe("one AI-use journey", () => {
  it("starts both homepage routes inside the same workbench", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toContain('href="/author"');
    expect(html).toContain('href="/author#connect"');
    expect(html).not.toContain('href="/discover"');
  });

  it("lets a person describe, connect or open an existing use from one screen", () => {
    const html = renderToStaticMarkup(<SimpleAIUseWorkbench />);
    expect(html).toContain("What do you use AI to do?");
    expect(html).toContain("Or connect a project");
    expect(html).toContain("Open an existing record");
    expect(html).toContain("Check (optional)");
    expect(html).toContain("Explain");
  });
});
