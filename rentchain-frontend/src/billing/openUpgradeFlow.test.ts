import { describe, expect, it, beforeEach, vi } from "vitest";

const createBillingPortalSessionMock = vi.fn();

vi.mock("@/api/billingApi", () => ({
  createBillingPortalSession: createBillingPortalSessionMock,
}));

describe("openUpgradeFlow", () => {
  beforeEach(() => {
    createBillingPortalSessionMock.mockReset();
  });

  it("routes free-tier users to the fallback upgrade path instead of opening the billing portal", async () => {
    const navigate = vi.fn();
    const { openUpgradeFlow } = await import("./openUpgradeFlow");

    const result = await openUpgradeFlow({
      navigate,
      fallbackPath: "/pricing",
      currentPlan: "free",
    });

    expect(result).toBe(false);
    expect(createBillingPortalSessionMock).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/pricing");
  });

  it("opens the billing portal for already-paying users", async () => {
    const navigate = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    createBillingPortalSessionMock.mockResolvedValue({ url: "https://example.test/portal" });
    const { openUpgradeFlow } = await import("./openUpgradeFlow");

    const result = await openUpgradeFlow({
      navigate,
      fallbackPath: "/pricing",
      currentPlan: "starter",
    });

    expect(result).toBe(true);
    expect(createBillingPortalSessionMock).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.test/portal",
      "_blank",
      "noopener,noreferrer"
    );
    expect(navigate).toHaveBeenCalledWith("/billing?upgradeStarted=1");

    openSpy.mockRestore();
  });
});
