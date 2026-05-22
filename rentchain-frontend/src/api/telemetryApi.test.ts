import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  isTelemetryEnabled: vi.fn(() => true),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("@/lib/telemetry", () => ({
  isTelemetryEnabled: mocks.isTelemetryEnabled,
}));

describe("logTelemetryEvent", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue({ ok: true });
    mocks.isTelemetryEnabled.mockReset();
    mocks.isTelemetryEnabled.mockReturnValue(true);
  });

  it("posts PDF print telemetry as a JSON object so apiFetch sets the JSON content type", async () => {
    const { logTelemetryEvent } = await import("./telemetryApi");

    await logTelemetryEvent("pdf_print_opened", {
      exportType: "print_summary",
      renderingPath: "window_print",
      status: "print_opened",
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/telemetry", {
      method: "POST",
      body: {
        eventName: "pdf_print_opened",
        eventProps: {
          exportType: "print_summary",
          renderingPath: "window_print",
          status: "print_opened",
        },
      },
    });
    expect(typeof mocks.apiFetch.mock.calls[0][1].body).toBe("object");
  });

  it("does not send unapproved event families", async () => {
    const { logTelemetryEvent } = await import("./telemetryApi");

    await logTelemetryEvent("print_opened", { exportType: "print_summary" });

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
