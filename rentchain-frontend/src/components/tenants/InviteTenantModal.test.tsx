import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteTenantModal } from "./InviteTenantModal";

const mocks = vi.hoisted(() => ({
  fetchProperties: vi.fn(),
  fetchUnitsForProperty: vi.fn(),
  createTenantInvite: vi.fn(),
  setOnboardingStep: vi.fn(),
  useCapabilities: vi.fn(),
  useAuth: vi.fn(),
  showToast: vi.fn(),
  dispatchUpgradePrompt: vi.fn(),
  track: vi.fn(),
}));

vi.mock("../../api/tenantInvites", () => ({
  createTenantInvite: mocks.createTenantInvite,
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: mocks.setOnboardingStep,
}));

vi.mock("../../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchProperties,
}));

vi.mock("../../api/unitsApi", () => ({
  fetchUnitsForProperty: mocks.fetchUnitsForProperty,
}));

vi.mock("../../hooks/useCapabilities", () => ({
  useCapabilities: () => mocks.useCapabilities(),
}));

vi.mock("../../context/useAuth", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../lib/upgradePrompt", () => ({
  dispatchUpgradePrompt: (...args: any[]) => mocks.dispatchUpgradePrompt(...args),
  resolveRequiredPlanLabel: () => "Starter",
}));

vi.mock("../../lib/analytics", () => ({
  track: (...args: any[]) => mocks.track(...args),
}));

describe("InviteTenantModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.fetchProperties.mockResolvedValue({ items: [{ id: "prop-1", name: "Harbour View" }] });
    mocks.fetchUnitsForProperty.mockResolvedValue([{ id: "unit-1", unitNumber: "101" }]);
    mocks.createTenantInvite.mockResolvedValue({ ok: true });
    mocks.setOnboardingStep.mockResolvedValue(undefined);
    mocks.useCapabilities.mockReturnValue({ features: { tenant_invites: false } });
    mocks.useAuth.mockReturnValue({ user: { id: "user-1", role: "landlord", plan: "free" } });
    mocks.showToast.mockReset();
    mocks.dispatchUpgradePrompt.mockReset();
    mocks.track.mockReset();
  });

  it("shows upgrade requirements immediately instead of the invite form when tenant invites are locked", () => {
    render(<InviteTenantModal open onClose={vi.fn()} />);

    expect(screen.getByText("Upgrade required")).toBeInTheDocument();
    expect(screen.getByText("Upgrade to Starter to send tenant invites.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock tenant invites" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Tenant email")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send invite" })).not.toBeInTheDocument();
  });
});
