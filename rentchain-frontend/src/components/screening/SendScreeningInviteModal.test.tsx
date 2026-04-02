import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SendScreeningInviteModal } from "./SendScreeningInviteModal";

vi.mock("../../api/propertiesApi", () => ({
  fetchProperties: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock("../../api/unitsApi", () => ({
  fetchUnitsForProperty: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../api/rentalApplicationsApi", () => ({
  createScreeningOrder: vi.fn(),
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../context/UpgradeContext", () => ({
  useUpgrade: vi.fn(),
}));

describe("SendScreeningInviteModal", () => {
  it("opens an upgrade flow instead of starting checkout when screening is not entitled", async () => {
    const { useEntitlements } = await import("@/hooks/useEntitlements");
    const { useUpgrade } = await import("../../context/UpgradeContext");
    const { createScreeningOrder } = await import("../../api/rentalApplicationsApi");
    const openUpgrade = vi.fn();

    vi.mocked(useEntitlements).mockReturnValue({
      canScreen: false,
      plan: "free",
      requiredPlanFor: () => "starter",
    } as any);
    vi.mocked(useUpgrade).mockReturnValue({ openUpgrade } as any);

    render(<SendScreeningInviteModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(openUpgrade).toHaveBeenCalled();
    expect(createScreeningOrder).not.toHaveBeenCalled();
  });
});
