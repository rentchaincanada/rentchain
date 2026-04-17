import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchUpgradePrompt,
  getUpgradePromptDetail,
  resolveRequiredPlanLabel,
} from "./upgradePrompt";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("upgradePrompt", () => {
  it("normalizes upgrade-required payloads into canonical prompt details", () => {
    const detail = getUpgradePromptDetail(
      {
        code: "PLAN_LIMIT_REACHED",
        capability: "tenant_invites",
        currentPlan: "core",
        source: "invite_modal",
      },
      403
    );

    expect(detail).toEqual({
      featureKey: "tenant_invites",
      currentPlan: "starter",
      requiredPlan: "starter",
      source: "invite_modal",
      redirectTo: undefined,
    });
  });

  it("dispatches normalized prompt details", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    dispatchUpgradePrompt({
      featureKey: "review_summary",
      currentPlan: "business",
      source: "review_page",
    });

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("upgrade:prompt");
    expect(event.detail).toMatchObject({
      featureKey: "review_summary",
      currentPlan: "elite",
      requiredPlan: "pro",
      source: "review_page",
    });
  });

  it("returns canonical required-plan labels", () => {
    expect(resolveRequiredPlanLabel("tenant_invites", "free")).toBe("Starter");
    expect(resolveRequiredPlanLabel("review_summary", "starter")).toBe("Pro");
  });
});
