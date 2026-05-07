import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EnterpriseMunicipalReadinessPage from "./EnterpriseMunicipalReadinessPage";

const mockFetchProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/enterpriseMunicipalReadinessApi", () => ({
  fetchEnterpriseMunicipalReadinessProfiles: (...args: any[]) => mockFetchProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, title }: any) => <main aria-label={title}>{children}</main>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  enterpriseMunicipalReadinessId: "enterprise_municipal:municipality:municipality",
  organizationType: "municipality",
  status: "ready_for_review",
  manualApprovalRequired: true,
  autonomousGovernmentExecutionEnabled: false,
  autonomousEnterpriseExecutionEnabled: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  institutionalReferences: [],
  portfolioGovernanceReferences: [],
  municipalReadinessReferences: [],
  regulatoryReferences: [],
  operationalRiskReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  enterpriseRestrictions: [],
  redactions: ["Sensitive tenant and public-sector execution payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("EnterpriseMunicipalReadinessPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockFetchProfiles.mockResolvedValue([profile]);
  });

  it("loads enterprise readiness with required safety copy", async () => {
    render(
      <MemoryRouter>
        <EnterpriseMunicipalReadinessPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Loading enterprise readiness...")).toBeInTheDocument();
    expect(await screen.findByText("Enterprise readiness summary")).toBeInTheDocument();
    expect(screen.getAllByText(/Enterprise and municipal readiness is operationally scoped and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No autonomous government or enterprise execution is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review remains required/i).length).toBeGreaterThan(0);
    expect(mockFetchProfiles).toHaveBeenCalledWith({ organizationType: "", status: "" });
  });

  it("filters profiles by organization type and status", async () => {
    render(
      <MemoryRouter>
        <EnterpriseMunicipalReadinessPage />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText("Organization type"), { target: { value: "municipality" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchProfiles).toHaveBeenLastCalledWith({ organizationType: "municipality", status: "blocked" });
    });
  });

  it("renders the empty state", async () => {
    mockFetchProfiles.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <EnterpriseMunicipalReadinessPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No enterprise readiness profiles match these filters.")).toBeInTheDocument();
  });
});
