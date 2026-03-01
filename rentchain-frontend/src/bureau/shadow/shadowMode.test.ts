import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getShadowSampleRate,
  getShadowTimeoutMs,
  isShadowModeEnabled,
  shouldShadowRun,
} from "./shadowMode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shadowMode", () => {
  it("is deterministic for the same seed", () => {
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "true");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE", "0.5");

    const first = shouldShadowRun("landlord:123:app:abc");
    const second = shouldShadowRun("landlord:123:app:abc");
    expect(first).toBe(second);
  });

  it("respects sampling boundaries", () => {
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "true");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE", "0");
    expect(shouldShadowRun("seed-1")).toBe(false);

    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE", "1");
    expect(shouldShadowRun("seed-1")).toBe(true);
  });

  it("parses enable flag and timeout defaults", () => {
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_MODE", "false");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_TIMEOUT_MS", "700");
    vi.stubEnv("VITE_BUREAU_ADAPTER_SHADOW_SAMPLE_RATE", "0.25");

    expect(isShadowModeEnabled()).toBe(false);
    expect(getShadowSampleRate()).toBe(0.25);
    expect(getShadowTimeoutMs()).toBe(700);
  });
});
