import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const defaultProperty = { id: "prop-1", name: "Harbour House" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SendScreeningInviteModal", () => {
  it("opens an upgrade flow instead of starting checkout when screening is not entitled", async () => {
    const { useEntitlements } = await import("@/hooks/useEntitlements");
    const { useUpgrade } = await import("../../context/UpgradeContext");
    const { fetchProperties } = await import("../../api/propertiesApi");
    const { createScreeningOrder } = await import("../../api/rentalApplicationsApi");
    const openUpgrade = vi.fn();

    vi.mocked(useEntitlements).mockReturnValue({
      canScreen: false,
      plan: "free",
      requiredPlanFor: () => "starter",
    } as any);
    vi.mocked(useUpgrade).mockReturnValue({ openUpgrade } as any);
    vi.mocked(fetchProperties).mockResolvedValue({ items: [defaultProperty] } as any);

    render(<SendScreeningInviteModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(openUpgrade).toHaveBeenCalled();
    expect(createScreeningOrder).not.toHaveBeenCalled();
  });

  it("disables repeat submission while checkout creation is in flight", async () => {
    const { useEntitlements } = await import("@/hooks/useEntitlements");
    const { useUpgrade } = await import("../../context/UpgradeContext");
    const { fetchProperties } = await import("../../api/propertiesApi");
    const { createScreeningOrder } = await import("../../api/rentalApplicationsApi");

    vi.mocked(useEntitlements).mockReturnValue({
      canScreen: true,
      plan: "starter",
      requiredPlanFor: () => "starter",
    } as any);
    vi.mocked(useUpgrade).mockReturnValue({ openUpgrade: vi.fn() } as any);
    vi.mocked(fetchProperties).mockResolvedValue({ items: [defaultProperty] } as any);

    let resolvePromise: ((value: any) => void) | null = null;
    vi.mocked(createScreeningOrder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }) as any
    );

    render(<SendScreeningInviteModal open onClose={vi.fn()} />);

    await screen.findByRole("option", { name: "Harbour House" });
    fireEvent.change(screen.getByDisplayValue("Select property"), { target: { value: "prop-1" } });
    fireEvent.change(screen.getByLabelText("Tenant email"), { target: { value: "tenant@example.com" } });

    const button = screen.getByRole("button", { name: "Send invite" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Starting..." })).toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Starting..." }));
    expect(createScreeningOrder).toHaveBeenCalledTimes(1);

    resolvePromise?.({ ok: false, errorCode: "SCREENING_CHECKOUT_ALREADY_EXISTS" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send invite" })).toBeEnabled();
    });
  });
});
