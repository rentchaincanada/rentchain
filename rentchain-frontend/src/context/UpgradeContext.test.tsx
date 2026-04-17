import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradeProvider } from "./UpgradeContext";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  useAuth: vi.fn(),
  getCachedCapabilities: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/entitlements", () => ({
  getCachedCapabilities: mocks.getCachedCapabilities,
}));

vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
}));

vi.mock("../components/billing/UpgradeModal", () => ({
  UpgradeModal: () => null,
}));

vi.mock("../components/billing/UpgradePromptModal", () => ({
  UpgradePromptModal: () => null,
}));

describe("UpgradeContext analytics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tracks upgrade prompt impressions from the canonical prompt handler", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "u1", role: "landlord", plan: "free" },
      ready: true,
      isLoading: false,
    });
    mocks.getCachedCapabilities.mockReturnValue({ plan: "free" });

    render(
      <UpgradeProvider>
        <div>child</div>
      </UpgradeProvider>
    );

    window.dispatchEvent(
      new CustomEvent("upgrade:prompt", {
        detail: {
          featureKey: "tenant_invites",
          currentPlan: "free",
          requiredPlan: "starter",
          source: "locked_feature",
          redirectTo: "/applications",
        },
      })
    );

    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith("upgrade_prompt_viewed", {
        featureKey: "tenant_invites",
        currentPlan: "free",
        requiredPlan: "starter",
        source: "locked_feature",
        presentation: "modal",
        route: "/",
      })
    );
  });
});
