import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperationalRiskPage from "./OperationalRiskPage";

const mockFetchOperationalRiskProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/operationalRiskApi", () => ({
  fetchOperationalRiskProfiles: (...args: any[]) => mockFetchOperationalRiskProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  operationalRiskId: "operational_risk:landlord-1:institution",
  riskScope: "institution",
  status: "attention_required",
  manualReviewRequired: true,
  autonomousRiskActionsEnabled: false,
  publicRiskExposureEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyVerifiedReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    lowSeverityReferences: 0,
    moderateSeverityReferences: 1,
    elevatedSeverityReferences: 0,
    criticalSeverityReferences: 0,
  },
  riskReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  onboardingReferences: [],
  trustReferences: [],
  workflowReferences: [],
  delinquencyReferences: [],
  auditReferences: [],
  redactions: ["Public risk exposure and autonomous enforcement are not enabled."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("OperationalRiskPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchOperationalRiskProfiles.mockResolvedValue([profile]);
  });

  it("renders operational risk and required safety copy", async () => {
    render(
      <MemoryRouter>
        <OperationalRiskPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Operational risk")).toBeInTheDocument();
    expect(screen.getAllByText(/No underwriting, autonomous enforcement, or public risk exposure is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View interoperability readiness" })).toHaveAttribute("href", "/interoperability-adapters");
    expect(screen.getByText("Public risk exposure and autonomous enforcement are not enabled.")).toBeInTheDocument();
  });

  it("updates deterministic scope, status, and severity filters", async () => {
    render(
      <MemoryRouter>
        <OperationalRiskPage />
      </MemoryRouter>
    );

    await screen.findByText("Operational risk");
    fireEvent.change(screen.getByLabelText("Risk scope"), { target: { value: "settlement" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });
    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "critical" } });

    await waitFor(() => {
      expect(mockFetchOperationalRiskProfiles).toHaveBeenLastCalledWith({
        riskScope: "settlement",
        status: "blocked",
        severity: "critical",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchOperationalRiskProfiles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <OperationalRiskPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No operational risk profiles match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Auto-enforce")).not.toBeInTheDocument();
    expect(screen.queryByText("Underwrite automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Public risk score")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous action")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve risk automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Public exposure")).not.toBeInTheDocument();
  });
});
