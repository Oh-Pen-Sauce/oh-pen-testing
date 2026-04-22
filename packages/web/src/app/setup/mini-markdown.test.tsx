import { describe, it, expect } from "vitest";
import { renderMiniMarkdown } from "./mini-markdown";
import { renderToStaticMarkup } from "react-dom/server";

function html(source: string): string {
  return renderToStaticMarkup(<>{renderMiniMarkdown(source)}</>);
}

describe("renderMiniMarkdown", () => {
  it("renders plain text as-is", () => {
    expect(html("hello")).toContain("hello");
  });

  it("renders **bold**", () => {
    const out = html("click **Generate token**.");
    expect(out).toContain("<strong");
    expect(out).toContain("Generate token");
  });

  it("renders `inline code`", () => {
    const out = html("run `claude --version`");
    expect(out).toContain("<code");
    expect(out).toContain("claude --version");
  });

  it("renders safe https links", () => {
    const out = html("visit [github](https://github.com/x/y)");
    expect(out).toContain(
      '<a href="https://github.com/x/y" target="_blank"',
    );
    expect(out).toContain(">github</a>");
  });

  it("drops javascript: hrefs — never emits a clickable anchor", () => {
    const out = html("[xss](javascript:alert(1))");
    // Security property: no anchor tag means no click vector. The raw
    // url may leak into the text fallback but it cannot execute.
    expect(out).not.toMatch(/<a [^>]*href/i);
  });

  it("preserves newlines as <br />", () => {
    const out = html("step 1\nstep 2");
    expect(out).toContain("<br/>");
    expect(out).toContain("step 1");
    expect(out).toContain("step 2");
  });

  it("handles nested mixed formatting in one line", () => {
    const out = html(
      "click **Generate** then run `ls -la` or read [docs](https://example.com).",
    );
    expect(out).toContain("<strong");
    expect(out).toContain("<code");
    expect(out).toContain("<a href");
  });
});
