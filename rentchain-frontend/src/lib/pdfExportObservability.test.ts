import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryMocks = vi.hoisted(() => ({
  logTelemetryEvent: vi.fn(),
}));

vi.mock("@/api/telemetryApi", () => ({
  logTelemetryEvent: telemetryMocks.logTelemetryEvent,
}));

function mockViewport() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1",
  });
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as any;
}

describe("pdfExportObservability", () => {
  beforeEach(() => {
    telemetryMocks.logTelemetryEvent.mockReset();
    mockViewport();
  });

  it("emits deterministic metadata without document contents", async () => {
    const { recordPdfExportEvent } = await import("./pdfExportObservability");
    recordPdfExportEvent("pdf_export_completed", {
      exportType: "lease_summary",
      renderingPath: "frontend_pdf_builder",
      status: "completed",
      durationMs: 12.4,
      byteSize: 99,
      errorCode: "No raw document text here",
    });

    expect(telemetryMocks.logTelemetryEvent).toHaveBeenCalledWith(
      "pdf_export_completed",
      expect.objectContaining({
        exportType: "lease_summary",
        renderingPath: "frontend_pdf_builder",
        status: "completed",
        durationMs: 12,
        byteSize: 99,
        browserClass: "safari",
        viewportCategory: "mobile",
        mobilePreviewUnsafe: true,
        errorCode: "no_raw_document_text_here",
      })
    );
  });
});
