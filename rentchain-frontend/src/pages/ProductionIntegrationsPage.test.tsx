import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductionIntegrationsPage from "./ProductionIntegrationsPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/productionIntegrationsApi", () => ({
  fetchProductionIntegrationProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  productionIntegrationId: "production_integration:registry-production:registry",
  integrationType: "registry",
  status: "sandbox_ready",
  manualApprovalRequired: true,
  autonomousExecutionEnabled: false,
  paymentExecutionEnabled: false,
  unrestrictedWebhookExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  activationReferences: [],
  observabilityReferences: [],
  rollbackReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  governanceReferences: [],
  auditReferences: [],
  integrationRestrictions: [],
  redactions: ["Sensitive provider and payment payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ProductionIntegrationsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads production integrations with required safety copy", async () => {
    render(
      <MemoryRouter>
        <ProductionIntegrationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading production integrations...")).toBeInTheDocument();
    expect(await screen.findByText("Production readiness summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Production integrations are operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No autonomous synchronization or unrestricted external execution is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual approval remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ integrationType: "", status: "" });
  });

  it("filters profiles by integration type and status", async () => {
    render(
      <MemoryRouter>
        <ProductionIntegrationsPage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText("Integration type"), { target: { value: "registry" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ integrationType: "registry", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ProductionIntegrationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No production integration profiles match these filters.")).toBeInTheDocument();
  });
});
