import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyDetailPanel } from "./PropertyDetailPanel";
import { AuthProvider } from "@/context/AuthContext";

const mocks = vi.hoisted(() => ({
  updateProperty: vi.fn(),
  getLeasesForProperty: vi.fn(),
  getPropertyMonthlyPayments: vi.fn(),
  fetchUnitsForProperty: vi.fn(),
  useCapabilities: vi.fn(),
  useEntitlements: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api/propertiesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/propertiesApi")>("../../api/propertiesApi");
  return {
    ...actual,
    updateProperty: mocks.updateProperty,
    archiveProperty: vi.fn(),
    publishProperty: vi.fn(),
    unarchiveProperty: vi.fn(),
  };
});

vi.mock("../../api/leasesApi", () => ({
  getLeasesForProperty: mocks.getLeasesForProperty,
}));

vi.mock("@/api/paymentsApi", () => ({
  getPropertyMonthlyPayments: mocks.getPropertyMonthlyPayments,
}));

vi.mock("../../api/unitsImportApi", () => ({
  importUnitsCsv: vi.fn(),
}));

vi.mock("../../api/unitsApi", () => ({
  fetchUnitsForProperty: mocks.fetchUnitsForProperty,
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: () => mocks.useCapabilities(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => mocks.useEntitlements(),
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({ openUpgrade: vi.fn() }),
}));

vi.mock("./UnitsCsvPreviewModal", () => ({
  UnitsCsvPreviewModal: () => null,
}));

vi.mock("./UnitEditModal", () => ({
  UnitEditModal: () => null,
}));

vi.mock("./SendApplicationModal", () => ({
  SendApplicationModal: () => null,
}));

vi.mock("@/components/leases/RiskScoreBadge", () => ({
  RiskScoreBadge: () => null,
}));

vi.mock("@/components/properties/PropertyCredibilitySummaryCard", () => ({
  PropertyCredibilitySummaryCard: () => null,
}));

describe("PropertyDetailPanel", () => {
  beforeEach(() => {
    mocks.updateProperty.mockResolvedValue({
      property: { id: "prop-1" },
    });
    mocks.getLeasesForProperty.mockResolvedValue({ leases: [], credibilitySummary: null });
    mocks.getPropertyMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });
    mocks.fetchUnitsForProperty.mockResolvedValue([]);
    mocks.showToast.mockReset();
    mocks.useCapabilities.mockReturnValue({
      caps: { plan: "starter" },
      features: { applications: true, unitsTable: true },
      loading: false,
    });
    mocks.useEntitlements.mockReturnValue({
      plan: "starter",
      hasCapability: (key: string) => key === "applications",
    });
  });

  it("opens a working property edit modal and saves changes", async () => {
    const onRefresh = vi.fn();
render(
  <AuthProvider>
    <MemoryRouter>
      <PropertyDetailPanel
        property={{
          id: "prop-1",
          name: "Harbour View",
          addressLine1: "12 Wharf Street",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          country: "Canada",
          totalUnits: 1,
          amenities: [],
          units: [],
          createdAt: new Date().toISOString(),
        }}
        onRefresh={onRefresh}
      />
    </MemoryRouter>
  </AuthProvider>
);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(await screen.findByRole("dialog", { name: "Edit property details" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Property name"), {
      target: { value: "Harbour View Residences" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Compliance & Registry \(Optional\)/i }));
    fireEvent.change(screen.getByLabelText("Property Identifier (PID)"), {
      target: { value: "ns_123-45" },
    });
    fireEvent.change(screen.getByLabelText("Address line 1"), {
      target: { value: "14 Wharf Street" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateProperty).toHaveBeenCalledWith(
        "prop-1",
        expect.objectContaining({
          name: "Harbour View Residences",
          pid: "ns_123-45",
          addressLine1: "14 Wharf Street",
          city: "Halifax",
          province: "NS",
        })
      );
    });
    expect(onRefresh).toHaveBeenCalled();
  });
});
