import { afterEach, describe, expect, it, vi } from "vitest";

import { getBureauProvider } from "../screening/providers/bureauProvider";

describe("bureauProvider safe defaults + aliases", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("defaults to disabled in production when provider env is missing", () => {
    delete process.env.BUREAU_PROVIDER;
    delete process.env.SCREENING_PROVIDER;
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "production";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const provider = getBureauProvider();

    expect(provider.name).toBe("disabled");
    expect(provider.isConfigured()).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[screening] provider fallback: missing BUREAU_PROVIDER in production; defaulting to disabled"
    );
  });

  it("maps tu_referral alias to transunion_referral", () => {
    process.env.BUREAU_PROVIDER = "tu_referral";
    const provider = getBureauProvider();
    expect(provider.name).toBe("transunion_referral");
  });

  it("maps transunion-referral alias to transunion_referral", () => {
    process.env.BUREAU_PROVIDER = "transunion-referral";
    const provider = getBureauProvider();
    expect(provider.name).toBe("transunion_referral");
  });
});

