import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(process.cwd(), "src");

describe("print PDF guardrails", () => {
  it("keeps global print roots free of mobile-dangerous sizing and absolute placement", () => {
    const indexCss = readFileSync(resolve(srcRoot, "index.css"), "utf8");
    const printCss = readFileSync(resolve(srcRoot, "styles/print.css"), "utf8");

    expect(indexCss).not.toMatch(/print-only-(summary|lease-renewals|application)[\s\S]*position:\s*absolute/i);
    expect(indexCss).not.toMatch(/print-only-(summary|lease-renewals|application)[\s\S]*min-height:\s*100vh/i);
    expect(printCss).not.toMatch(/\.rc-print-area[\s\S]*position:\s*absolute/i);
    expect(printCss).not.toMatch(/\.rc-print-area[\s\S]*overflow:\s*hidden/i);
  });

  it("keeps application print view from reserving a viewport-height phantom page", () => {
    const source = readFileSync(
      resolve(srcRoot, "components/applications/PrintApplicationView.tsx"),
      "utf8"
    );

    expect(source).not.toMatch(/position:\s*absolute/);
    expect(source).not.toMatch(/inset:\s*0/);
    expect(source).not.toMatch(/min-height:\s*100vh/);
    expect(source).toMatch(/overflow:\s*visible/);
    expect(source).toMatch(/transform:\s*none/);
  });
});
