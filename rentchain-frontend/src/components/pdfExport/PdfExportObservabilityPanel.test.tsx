import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PdfExportObservabilityPanel } from "./PdfExportObservabilityPanel";
import type { PdfExportDiagnostics } from "@/api/pdfExportObservabilityApi";

const diagnostics: PdfExportDiagnostics = {
  diagnosticsId: "pdf_export_observability:latest",
  generatedAt: "2026-05-08T10:00:00.000Z",
  manualReviewRequired: true,
  telemetryExecutionBlockingEnabled: false,
  sensitiveContentLogged: false,
  summary: {
    totalEvents: 3,
    started: 1,
    completed: 1,
    failed: 1,
    mobileFallbacks: 1,
    downloads: 1,
    prints: 0,
    averageDurationMs: 40,
    totalBytes: 2048,
  },
  byExportType: [{ exportType: "lease_summary", totalEvents: 2, completed: 1, failed: 1, mobileFallbacks: 0 }],
  byRenderingPath: [{ renderingPath: "frontend_pdf_builder", totalEvents: 2 }],
  recentEvents: [
    {
      eventId: "event-1",
      eventName: "pdf_export_failed",
      createdAt: "2026-05-08T10:00:00.000Z",
      exportType: "lease_summary",
      renderingPath: "frontend_pdf_builder",
      status: "failed",
      browserClass: "chrome",
      viewportCategory: "desktop",
      durationMs: 40,
      byteSize: null,
      errorCode: "render_failed",
    },
  ],
  privacyBoundaries: ["PDF telemetry stores export metadata only."],
};

describe("PdfExportObservabilityPanel", () => {
  it("renders diagnostics and privacy boundaries", () => {
    render(<PdfExportObservabilityPanel diagnostics={diagnostics} />);

    expect(screen.getByText("PDF export observability")).toBeInTheDocument();
    expect(screen.getByText("Mobile fallbacks")).toBeInTheDocument();
    expect(screen.getByText(/PDF export telemetry is operational metadata only/i)).toBeInTheDocument();
    expect(screen.getByText("Lease Summary")).toBeInTheDocument();
    expect(screen.getByText("render_failed")).toBeInTheDocument();
    expect(screen.getByText("PDF telemetry stores export metadata only.")).toBeInTheDocument();
  });
});
