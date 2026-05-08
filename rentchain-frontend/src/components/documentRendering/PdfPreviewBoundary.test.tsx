import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfPreviewBoundary } from "./PdfPreviewBoundary";

const mocks = vi.hoisted(() => ({
  recordPdfExportEvent: vi.fn(),
  useMobilePdfPreviewGuard: vi.fn(),
}));

vi.mock("@/lib/pdfExportObservability", () => ({
  recordPdfExportEvent: mocks.recordPdfExportEvent,
}));

vi.mock("@/utils/pdfPreviewGuard", () => ({
  useMobilePdfPreviewGuard: mocks.useMobilePdfPreviewGuard,
}));

describe("PdfPreviewBoundary accessibility", () => {
  it("labels the desktop iframe preview", () => {
    mocks.useMobilePdfPreviewGuard.mockReturnValue(false);

    render(
      <PdfPreviewBoundary
        pdfUrl="/sample.pdf"
        exportType="sample_screening_report"
        title="Open the sample PDF"
        iframeTitle="Sample screening report PDF"
      />
    );

    expect(screen.getByTitle("Sample screening report PDF")).toHaveAttribute(
      "aria-label",
      "Sample screening report PDF"
    );
  });

  it("labels mobile fallback controls with document context", () => {
    mocks.useMobilePdfPreviewGuard.mockReturnValue(true);

    render(
      <PdfPreviewBoundary
        pdfUrl="/sample.pdf"
        exportType="sample_screening_report"
        title="Open the sample PDF"
        iframeTitle="Sample screening report PDF"
      />
    );

    expect(screen.getByRole("region", { name: "Open the sample PDF" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sample screening report PDF: open PDF in a new tab" })).toHaveAttribute(
      "href",
      "/sample.pdf"
    );
    expect(screen.getByRole("link", { name: "Sample screening report PDF: download PDF" })).toHaveAttribute(
      "download"
    );
  });
});
