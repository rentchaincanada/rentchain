import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

import {
  __resetShadowLoggerSessionForTests,
  clearShadowEventsBuffer,
  getShadowEventsBuffer,
  logShadowEvent,
} from "./shadowLogger";

const baseEvent = {
  eventType: "bureau_shadow" as const,
  name: "quote",
  seedKey: "tenant-123",
  primary: { provider: "transunion", ok: true, durationMs: 10 },
  shadow: { provider: "mock", ok: false, errorCode: "timeout" },
  diff: { isMatch: false, fields: ["provider"] },
  meta: {
    appId: "app-123",
    landlordId: "landlord-123",
    envMode: "production",
    buildSha: "build-1",
    ts: new Date().toISOString(),
  },
};

describe("shadowLogger", () => {
  beforeEach(() => {
    trackMock.mockReset();
    __resetShadowLoggerSessionForTests();
    clearShadowEventsBuffer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not send telemetry when shadow mode is off", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "false");

    logShadowEvent(baseEvent);
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("enforces session cap for telemetry send volume", () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "true");

    for (let i = 0; i < 60; i += 1) {
      logShadowEvent({
        ...baseEvent,
        seedKey: `seed-${i}`,
      });
    }

    expect(trackMock).toHaveBeenCalledTimes(50);
  });

  it("stores hashed identifiers in buffered event payload", () => {
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "true");

    logShadowEvent(baseEvent);
    const [first] = getShadowEventsBuffer();

    expect(first.seedKey).not.toBe(baseEvent.seedKey);
    expect(first.meta.appKey).toBeDefined();
    expect((first.meta as any).appId).toBeUndefined();
    expect((first.meta as any).landlordId).toBeUndefined();
  });
});
