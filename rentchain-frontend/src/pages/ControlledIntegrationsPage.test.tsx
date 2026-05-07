import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ControlledIntegrationsPage from "./ControlledIntegrationsPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/controlledIntegrationsApi", () => ({
  fetchControlledIntegrationProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  controlledIntegrationId: "controlled_integration:test:registry",
  integrationType: "registry",
  status: "sandbox_ready",
  manualApprovalRequired: true,
  liveSynchronizationEnabled: false,
  autonomousExecutionEnabled: false,
  webhookExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  adapterReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  observabilityReferences: [],
  releaseGovernanceReferences: [],
  auditReferences: [],
  integrationRestrictions: [],
  redactions: ["Provider credentials are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ControlledIntegrationsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads and renders controlled integration profiles with required safety copy", async () => {
    render(
      <MemoryRouter>
        <ControlledIntegrationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading controlled integrations...")).toBeInTheDocument();
    expect(await screen.findByText("Integration summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Controlled integrations are operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual approval remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ integrationType: "", status: "" });
  });

  it("filters profiles by integration type and status", async () => {
    render(
      <MemoryRouter>
        <ControlledIntegrationsPage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findAllByLabelText("Integration type"))[0], { target: { value: "registry" } });
    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ integrationType: "registry", status: "" });
    });

    fireEvent.change((await screen.findAllByLabelText("Status"))[0], { target: { value: "blocked" } });
    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ integrationType: "registry", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ControlledIntegrationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No controlled integration profiles match these filters.")).toBeInTheDocument();
  });
});
