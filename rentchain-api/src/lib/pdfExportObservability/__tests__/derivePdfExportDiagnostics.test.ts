import { describe, expect, it } from "vitest";
import { derivePdfExportDiagnostics } from "../derivePdfExportDiagnostics";

describe("derivePdfExportDiagnostics", () => {
  it("derives deterministic PDF export diagnostics without sensitive content", () => {
    const diagnostics = derivePdfExportDiagnostics([
      {
        id: "event-1",
        eventName: "pdf_export_started",
        createdAt: Date.parse("2026-05-08T10:00:00.000Z"),
        eventProps: {
          exportType: "lease_summary",
          renderingPath: "frontend_pdf_builder",
          status: "started",
        },
      } as any,
      {
        id: "event-2",
        eventName: "pdf_export_completed",
        createdAt: Date.parse("2026-05-08T10:00:01.000Z"),
        eventProps: {
          exportType: "lease_summary",
          renderingPath: "frontend_pdf_builder",
          status: "completed",
          durationMs: 41,
          byteSize: 2048,
          documentText: "must not be projected",
        },
      } as any,
      {
        id: "event-3",
        eventName: "pdf_mobile_fallback_used",
        createdAt: Date.parse("2026-05-08T10:00:02.000Z"),
        eventProps: {
          exportType: "sample_screening_report",
          renderingPath: "mobile_fallback",
          status: "fallback_used",
          browserClass: "safari",
          viewportCategory: "mobile",
        },
      } as any,
      {
        id: "event-4",
        eventName: "nudge_opened",
        createdAt: Date.parse("2026-05-08T10:00:03.000Z"),
        eventProps: {},
      } as any,
    ]);

    expect(diagnostics.manualReviewRequired).toBe(true);
    expect(diagnostics.telemetryExecutionBlockingEnabled).toBe(false);
    expect(diagnostics.sensitiveContentLogged).toBe(false);
    expect(diagnostics.summary).toMatchObject({
      totalEvents: 3,
      started: 1,
      completed: 1,
      mobileFallbacks: 1,
      averageDurationMs: 41,
      totalBytes: 2048,
    });
    expect(diagnostics.byExportType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exportType: "lease_summary", totalEvents: 2, completed: 1 }),
        expect.objectContaining({ exportType: "sample_screening_report", mobileFallbacks: 1 }),
      ])
    );
    expect(JSON.stringify(diagnostics)).not.toContain("must not be projected");
  });
});
