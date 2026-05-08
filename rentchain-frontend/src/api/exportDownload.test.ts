import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthTokenMock: vi.fn(),
  logTelemetryEventMock: vi.fn(),
}));

vi.mock("./config", () => ({
  apiUrl: (path: string) => `https://rentchain.example.com${path}`,
}));

vi.mock("../lib/authToken", () => ({
  getAuthToken: mocks.getAuthTokenMock,
}));

vi.mock("./telemetryApi", () => ({
  logTelemetryEvent: mocks.logTelemetryEventMock,
}));

describe("exportDownload", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.getAuthTokenMock.mockReset();
    mocks.logTelemetryEventMock.mockReset();
    mocks.getAuthTokenMock.mockReturnValue("session-token");
  });

  it("parses Content-Disposition filenames consistently", async () => {
    const { parseContentDispositionFilename } = await import("./exportDownload");

    expect(parseContentDispositionFilename('attachment; filename="admin-leases-2026-04-01.csv"', "fallback.csv")).toBe(
      "admin-leases-2026-04-01.csv"
    );
    expect(
      parseContentDispositionFilename("attachment; filename*=UTF-8''rentchain%20expenses.xls", "fallback.xls")
    ).toBe("rentchain expenses.xls");
    expect(parseContentDispositionFilename(null, "fallback.csv")).toBe("fallback.csv");
  });

  it("keeps authenticated export downloads using the shared filename parser", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["csv"]),
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-disposition"
            ? 'attachment; filename="rentchain-payments-2026-04-29.csv"'
            : null,
      },
    } as any) as any;

    const { downloadAuthenticatedExport } = await import("./exportDownload");
    const result = await downloadAuthenticatedExport({
      path: "/payments/export.csv",
      fallbackFilename: "rentchain-payments-export",
      errorMessage: "Failed to export payments",
    });

    expect(global.fetch).toHaveBeenCalledWith("https://rentchain.example.com/payments/export.csv", {
      method: "GET",
      headers: { Authorization: "Bearer session-token" },
      credentials: "include",
    });
    expect(result.filename).toBe("rentchain-payments-2026-04-29.csv");
  });

  it("emits non-blocking PDF export telemetry when observability metadata is provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
      headers: {
        get: () => 'attachment; filename="lease-ledger.pdf"',
      },
    } as any) as any;

    const { downloadAuthenticatedExport } = await import("./exportDownload");
    await downloadAuthenticatedExport({
      path: "/leases/lease-1/ledger/export.pdf",
      fallbackFilename: "lease-ledger.pdf",
      errorMessage: "Failed to export lease ledger",
      observability: {
        exportType: "lease_ledger",
        renderingPath: "backend_pdfkit",
      },
    });

    expect(mocks.logTelemetryEventMock).toHaveBeenCalledWith(
      "pdf_export_started",
      expect.objectContaining({ exportType: "lease_ledger", renderingPath: "backend_pdfkit" })
    );
    expect(mocks.logTelemetryEventMock).toHaveBeenCalledWith(
      "pdf_export_completed",
      expect.objectContaining({ exportType: "lease_ledger", byteSize: 3 })
    );
  });
});
