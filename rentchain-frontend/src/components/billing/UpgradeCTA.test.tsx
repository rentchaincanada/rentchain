import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradeCTA } from "./UpgradeCTA";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: () => ({
    user: {
      plan: "core",
    },
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: mocks.track,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UpgradeCTA", () => {
  it("dispatches the canonical upgrade prompt flow", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<UpgradeCTA featureKey="tenant_invites" label="Upgrade now" source="unit_test" />);

    fireEvent.click(screen.getByRole("button", { name: "Upgrade now" }));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("upgrade:prompt");
    expect(event.detail).toMatchObject({
      featureKey: "tenant_invites",
      currentPlan: "starter",
      requiredPlan: "starter",
      source: "unit_test",
      redirectTo: "/",
    });
    expect(mocks.track).toHaveBeenCalledWith("upgrade_cta_clicked", {
      featureKey: "tenant_invites",
      currentPlan: "core",
      requiredPlan: "starter",
      source: "unit_test",
      presentation: undefined,
      route: "/",
    });
  });
});
