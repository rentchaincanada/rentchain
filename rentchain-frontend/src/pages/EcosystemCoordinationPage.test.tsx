import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EcosystemCoordinationPage from "./EcosystemCoordinationPage";

const mockFetchSnapshots = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/ecosystemCoordinationApi", () => ({
  fetchEcosystemCoordinationSnapshots: (...args: any[]) => mockFetchSnapshots(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const snapshot = {
  ecosystemCoordinationId: "ecosystem_coordination:institutional:v1",
  status: "stable",
  manualReviewRequired: true,
  autonomousCoordinationEnabled: false,
  externalExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  participantReferences: [],
  trustReferences: [],
  onboardingReferences: [],
  riskReferences: [],
  integrationReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  observabilityReferences: [],
  governanceReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  auditReferences: [],
  ecosystemRestrictions: [],
  redactions: ["Sensitive tenant, payment, telemetry, and execution payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("EcosystemCoordinationPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchSnapshots.mockResolvedValue([snapshot]);
  });

  it("loads and renders ecosystem coordination snapshots with required safety copy", async () => {
    render(
      <MemoryRouter>
        <EcosystemCoordinationPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading ecosystem coordination...")).toBeInTheDocument();
    expect(await screen.findByText("Ecosystem summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Ecosystem coordination is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchSnapshots).toHaveBeenCalledWith({ status: "" });
  });

  it("filters snapshots by status", async () => {
    render(
      <MemoryRouter>
        <EcosystemCoordinationPage />
      </MemoryRouter>
    );

    fireEvent.change((await screen.findAllByLabelText("Status"))[0], { target: { value: "blocked" } });
    await waitFor(() => {
      expect(mockFetchSnapshots).toHaveBeenLastCalledWith({ status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchSnapshots.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <EcosystemCoordinationPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No ecosystem coordination snapshots match these filters.")).toBeInTheDocument();
  });
});
