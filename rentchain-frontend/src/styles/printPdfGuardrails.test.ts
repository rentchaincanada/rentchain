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

  it("routes print helpers through the shared document-rendering foundation", () => {
    const printSummary = readFileSync(resolve(srcRoot, "utils/printSummary.ts"), "utf8");
    const leaseSummaryPdf = readFileSync(resolve(srcRoot, "utils/leaseSummaryPdf.ts"), "utf8");
    const samplePdfModal = readFileSync(resolve(srcRoot, "components/billing/SamplePdfModal.tsx"), "utf8");
    const samplePdfPage = readFileSync(resolve(srcRoot, "pages/PdfSamplePage.tsx"), "utf8");

    expect(printSummary).toMatch(/createPrintRoot/);
    expect(printSummary).toMatch(/PRINT_ROOT_ACTIVE_ATTRIBUTE/);
    expect(leaseSummaryPdf).toMatch(/shouldStartNewPage/);
    expect(leaseSummaryPdf).toMatch(/wrapTextForPdf/);
    expect(samplePdfModal).toMatch(/PdfPreviewBoundary/);
    expect(samplePdfPage).toMatch(/PdfPreviewBoundary/);
  });

  it("allows only the mounted marketing page to bypass report print isolation", () => {
    const indexCss = readFileSync(resolve(srcRoot, "index.css"), "utf8");
    const printCss = readFileSync(resolve(srcRoot, "styles/print.css"), "utf8");
    const landingCss = readFileSync(
      resolve(srcRoot, "pages/marketing/landing/landingPageCss.ts"),
      "utf8"
    );

    expect(indexCss).toMatch(/body:not\(\[data-print-root-active="true"\]\):not\(\[data-marketing-print-active="true"\]\) \*/);
    expect(printCss).toMatch(/body:not\(\[data-marketing-print-active="true"\]\) \*/);
    expect(landingCss).toMatch(/@media print/);
    expect(landingCss).toMatch(/print-color-adjust: exact !important/);
    expect(landingCss).toMatch(/\.rc-reveal \{[\s\S]*?opacity: 1;/);
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
    expect(source).toMatch(/<article className="print-application-view"/);
    expect(source).toMatch(/aria-label="Application summary print view"/);
    expect(source).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
