import { afterEach, describe, expect, it, vi } from "vitest";

import { hashSeedKey, parseAllowlist, shouldUseAdapterPrimary } from "../screening/cutoverConfig";
import { runPrimaryWithFallback } from "../screening/runPrimaryWithFallback";

function parseCutoverEvents(spy: any) {
  return spy.mock.calls
    .filter((args: any[]) => args?.[0] === "[bureau_cutover]" && typeof args?.[1] === "string")
    .map((args: any[]) => JSON.parse(args[1]));
}

describe("cutoverConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("is deterministic for same seed key", () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "0.5";

    const seed = "app_123";
    const first = shouldUseAdapterPrimary(seed);
    const second = shouldUseAdapterPrimary(seed);
    expect(first).toBe(second);
  });

  it("respects sample rate boundaries", () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "0";
    expect(shouldUseAdapterPrimary("any")).toBe(false);

    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "1";
    expect(shouldUseAdapterPrimary("any")).toBe(true);
  });

  it("allowlist supports raw and hashed keys", () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "0";
    const raw = "application_abc";
    const hash = hashSeedKey(raw);
    process.env.BUREAU_ADAPTER_PRIMARY_ALLOWLIST = `other, ${raw}, sha256:${hash}`;

    const allowlist = parseAllowlist();
    expect(allowlist.has(raw)).toBe(true);
    expect(allowlist.has(`sha256:${hash}`)).toBe(true);
    expect(shouldUseAdapterPrimary(raw)).toBe(true);
  });
});

describe("runPrimaryWithFallback", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("falls back to legacy when adapter throws", async () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "1";
    process.env.BUREAU_ADAPTER_FALLBACK_ENABLED = "true";

    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await runPrimaryWithFallback({
      name: "quote",
      seedKey: "seed-1",
      runAdapter: async () => {
        throw new Error("adapter_failed");
      },
      runLegacy: async () => ({ ok: true, source: "legacy" }),
    });

    expect(result).toEqual({ ok: true, source: "legacy" });
    const events = parseCutoverEvents(consoleSpy);
    const last = events[events.length - 1];
    expect(last?.responseSource).toBe("legacy");
  });

  it("falls back to legacy when adapter times out", async () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "1";
    process.env.BUREAU_ADAPTER_PRIMARY_TIMEOUT_MS = "5";
    process.env.BUREAU_ADAPTER_FALLBACK_ENABLED = "true";

    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await runPrimaryWithFallback({
      name: "checkout",
      seedKey: "seed-timeout",
      runAdapter: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true, source: "adapter" }), 50);
        }),
      runLegacy: async () => ({ ok: true, source: "legacy" }),
      timeoutMs: 5,
    });

    expect(result).toEqual({ ok: true, source: "legacy" });
    const events = parseCutoverEvents(consoleSpy);
    const last = events[events.length - 1];
    expect(last?.responseSource).toBe("legacy");
  });

  it("returns adapter when adapter primary succeeds", async () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "true";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "1";
    process.env.BUREAU_ADAPTER_FALLBACK_ENABLED = "true";

    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await runPrimaryWithFallback({
      name: "quote",
      seedKey: "seed-adapter-success",
      runAdapter: async () => ({ ok: true, source: "adapter" }),
      runLegacy: async () => ({ ok: true, source: "legacy" }),
    });

    expect(result).toEqual({ ok: true, source: "adapter" });
    const events = parseCutoverEvents(consoleSpy);
    const last = events[events.length - 1];
    expect(last?.responseSource).toBe("adapter");
  });

  it("returns legacy when adapter is not selected", async () => {
    process.env.BUREAU_ADAPTER_PRIMARY_MODE = "false";
    process.env.BUREAU_ADAPTER_PRIMARY_SAMPLE_RATE = "1";

    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await runPrimaryWithFallback({
      name: "quote",
      seedKey: "seed-legacy-selected",
      runAdapter: async () => ({ ok: true, source: "adapter" }),
      runLegacy: async () => ({ ok: true, source: "legacy" }),
    });

    expect(result).toEqual({ ok: true, source: "legacy" });
    const events = parseCutoverEvents(consoleSpy);
    const last = events[events.length - 1];
    expect(last?.responseSource).toBe("legacy");
  });
});
