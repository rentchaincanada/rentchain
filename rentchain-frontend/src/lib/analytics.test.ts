import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTelemetryEnabled: vi.fn(() => true),
  resolveApiUrl: vi.fn((path: string) => `https://api.rentchain.test${path}`),
}));

vi.mock("./telemetry", () => ({
  isTelemetryEnabled: mocks.isTelemetryEnabled,
}));

vi.mock("./apiClient", () => ({
  resolveApiUrl: mocks.resolveApiUrl,
}));

describe("track", () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isTelemetryEnabled.mockReturnValue(true);
    mocks.resolveApiUrl.mockImplementation((path: string) => `https://api.rentchain.test${path}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))) as typeof fetch
    );
    vi.stubGlobal("window", {
      doNotTrack: "0",
    });
    vi.stubGlobal("navigator", {
      doNotTrack: "0",
      globalPrivacyControl: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = originalFetch;
    globalThis.navigator = originalNavigator;
    globalThis.window = originalWindow;
  });

  it("posts analytics to the resolved backend API URL", async () => {
    vi.stubEnv("MODE", "production");
    const { track } = await import("./analytics");

    track("billing_page_opened", { surface: "billing_page" });
    await Promise.resolve();

    expect(mocks.resolveApiUrl).toHaveBeenCalledWith("/api/events/track");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.rentchain.test/api/events/track",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        keepalive: true,
      })
    );
  });

  it("posts activation analytics events through the same tracker endpoint", async () => {
    vi.stubEnv("MODE", "production");
    const { track } = await import("./analytics");

    track("activation_property_created", {
      surface: "properties_page",
      source: "add_property_form",
      plan: "free",
      route: "/properties",
    });
    await Promise.resolve();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.rentchain.test/api/events/track",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        keepalive: true,
      })
    );
    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const payload = JSON.parse(String(fetchCall?.[1]?.body || "{}"));
    expect(payload).toEqual(
      expect.objectContaining({
        name: "activation_property_created",
        props: {
          surface: "properties_page",
          source: "add_property_form",
          plan: "free",
          route: "/properties",
        },
        ts: expect.any(String),
      })
    );
  });

  it("does not post when telemetry is disabled", async () => {
    vi.stubEnv("MODE", "production");
    mocks.isTelemetryEnabled.mockReturnValue(false);
    const { track } = await import("./analytics");

    track("billing_page_opened", { surface: "billing_page" });
    await Promise.resolve();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not post when DNT blocks tracking", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubGlobal("navigator", {
      doNotTrack: "1",
      globalPrivacyControl: false,
    });
    const { track } = await import("./analytics");

    track("billing_page_opened", { surface: "billing_page" });
    await Promise.resolve();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
