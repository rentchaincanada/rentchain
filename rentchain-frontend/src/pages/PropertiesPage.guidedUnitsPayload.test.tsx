import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropertiesPage from "./PropertiesPage";

const mocks = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  fetchPropertiesMock: vi.fn(),
  fetchCountsMock: vi.fn(),
  showToastMock: vi.fn(),
  useToastMock: vi.fn(),
  useAuthMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  printSummaryDocumentMock: vi.fn(),
}));

vi.mock("../api/apiFetch", () => ({
  apiFetch: mocks.apiFetchMock,
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../components/layout/MacShell", () => ({
  MacShell: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../components/properties/AddPropertyForm", () => ({
  AddPropertyForm: ({ onCreated }: any) => (
    <div>
      {onCreated ? (
        <button
          type="button"
          onClick={() =>
            onCreated({
              id: "prop-created",
              name: "Created Property",
              portfolioStatus: "active",
            })
          }
        >
          Complete property setup
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("../components/property/PropertyActivityPanel", () => ({
  PropertyActivityPanel: () => <div>Activity</div>,
}));

vi.mock("../components/properties/PropertyDetailPanel", () => ({
  PropertyDetailPanel: ({ property }: any) => (
    <div>
      {(property?.units || []).map((unit: any) => (
        <div key={String(unit?.id || unit?.unitNumber)}>{`${unit?.id}:${unit?.unitNumber}`}</div>
      ))}
    </div>
  ),
}));

vi.mock("../components/properties/PropertySelector", () => ({
  PropertySelector: () => <div>Selector</div>,
}));

vi.mock("../components/billing/UpgradeCTA", () => ({
  UpgradeCTA: ({ label }: { label?: string }) => <button type="button">{label || "Upgrade"}</button>,
}));

vi.mock("../components/ActionRequestsPanel", () => ({
  ActionRequestsPanel: () => <div>Actions</div>,
}));

vi.mock("../components/action-center/ActionCenterDrawer", () => ({
  ActionCenterDrawer: () => null,
}));

vi.mock("../components/leases/LeasePackGeneratorModal", () => ({
  LeasePackGeneratorModal: () => null,
}));

vi.mock("../api/actionRequestCountsApi", () => ({
  fetchActionRequestCounts: mocks.fetchCountsMock,
}));

vi.mock("../api/actionRequestsApi", () => ({
  listActionRequests: vi.fn().mockResolvedValue([]),
  acknowledgeActionRequest: vi.fn(),
  resolveActionRequest: vi.fn(),
}));

vi.mock("../api/actionSnapshotApi", () => ({
  fetchMonthlyOpsSnapshot: vi.fn().mockResolvedValue({ properties: {} }),
}));

vi.mock("../api/onboardingApi", () => ({
  setOnboardingStep: vi.fn(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: mocks.useToastMock,
}));

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../utils/printSummary", () => ({
  printSummaryDocument: mocks.printSummaryDocumentMock,
}));

vi.mock("../lib/analytics", () => ({
  track: vi.fn(),
}));

describe("PropertiesPage guided unit payload", () => {
  beforeEach(() => {
    mocks.apiFetchMock.mockReset();
    mocks.fetchPropertiesMock.mockReset();
    mocks.fetchCountsMock.mockReset();
    mocks.showToastMock.mockReset();
    mocks.useToastMock.mockReset();
    mocks.useAuthMock.mockReset();
    mocks.useCapabilitiesMock.mockReset();
    mocks.printSummaryDocumentMock.mockReset();

    mocks.fetchPropertiesMock
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [{ id: "prop-created", name: "Created Property" }] });
    mocks.fetchCountsMock.mockResolvedValue({ counts: {} });
    mocks.apiFetchMock.mockResolvedValue({
      ok: true,
      created: 1,
      units: [{ id: "unit-created-1", unitNumber: "101" }],
    });
    mocks.useToastMock.mockReturnValue({ showToast: mocks.showToastMock });
    mocks.useAuthMock.mockReturnValue({
      user: { id: "user-1", plan: "free", role: "landlord" },
    });
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: { tenant_invites: false },
      loading: false,
    });
    mocks.printSummaryDocumentMock.mockResolvedValue(undefined);
  });

  const openGuidedUnitModal = async () => {
    render(
      <MemoryRouter>
        <PropertiesPage />
      </MemoryRouter>
    );

    const setupButtons = await screen.findAllByRole("button", {
      name: "Complete property setup",
    });
    fireEvent.click(setupButtons[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Add a unit" }));
  };

  it("posts a non-empty units array for a vacant guided unit", async () => {
    await openGuidedUnitModal();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.apiFetchMock).toHaveBeenCalledWith(
        "/properties/prop-created/units",
        expect.objectContaining({
          method: "POST",
          body: {
            units: [
              expect.objectContaining({
                unitNumber: "101",
                status: "vacant",
                occupantName: null,
                leaseEndDate: null,
              }),
            ],
          },
        })
      );
    });
  });

  it("posts occupied guided unit metadata in the units array", async () => {
    await openGuidedUnitModal();

    fireEvent.change(screen.getByLabelText("Unit number 1"), { target: { value: "202" } });
    fireEvent.change(screen.getByLabelText("Status 1"), { target: { value: "occupied" } });
    fireEvent.change(screen.getByLabelText("Occupant name 1"), { target: { value: "Alice Tenant" } });
    fireEvent.change(screen.getByLabelText("Lease end date 1"), { target: { value: "2027-05-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));

    await waitFor(() => {
      expect(mocks.apiFetchMock).toHaveBeenCalledWith(
        "/properties/prop-created/units",
        expect.objectContaining({
          method: "POST",
          body: {
            units: [
              expect.objectContaining({
                unitNumber: "202",
                status: "occupied",
                occupantName: "Alice Tenant",
                leaseEndDate: "2027-05-31",
              }),
            ],
          },
        })
      );
    });
  });
});
