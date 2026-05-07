import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReleaseGovernancePage from "./ReleaseGovernancePage";

const mockFetchReleaseGovernanceProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/releaseGovernanceApi", () => ({
  fetchReleaseGovernanceProfiles: (...args: any[]) => mockFetchReleaseGovernanceProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  releaseGovernanceId: "release_governance:v0.9.0-core-foundation",
  releaseVersion: "v0.9.0-core-foundation",
  status: "ready_for_review",
  manualApprovalRequired: true,
  autonomousDeploymentEnabled: false,
  autonomousRollbackEnabled: false,
  publicLaunchEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  releaseReferences: [],
  deploymentReferences: [],
  rollbackReferences: [],
  qaReferences: [],
  operationalRiskReferences: [],
  evidenceReferences: [],
  reviewReferences: [],
  auditReferences: [],
  releaseRestrictions: [],
  redactions: ["Release governance is readiness metadata only; no autonomous deployment, rollback, or launch execution is enabled."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("ReleaseGovernancePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchReleaseGovernanceProfiles.mockResolvedValue([profile]);
  });

  it("renders release governance and required safety copy", async () => {
    render(
      <MemoryRouter>
        <ReleaseGovernancePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Release governance")).toBeInTheDocument();
    expect(screen.getAllByText(/No autonomous deployment, rollback, or public launch execution is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Release governance is readiness metadata only; no autonomous deployment, rollback, or launch execution is enabled.")).toBeInTheDocument();
  });

  it("updates deterministic release and status filters", async () => {
    render(
      <MemoryRouter>
        <ReleaseGovernancePage />
      </MemoryRouter>
    );

    await screen.findByText("Release governance");
    fireEvent.change(screen.getByLabelText("Release version"), { target: { value: "v1.0.0" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchReleaseGovernanceProfiles).toHaveBeenLastCalledWith({
        releaseVersion: "v1.0.0",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchReleaseGovernanceProfiles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <ReleaseGovernancePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No release governance profiles match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Deploy automatically")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-rollback")).not.toBeInTheDocument();
    expect(screen.queryByText("Public launch")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous deployment")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-approve release")).not.toBeInTheDocument();
    expect(screen.queryByText("Trigger production deploy")).not.toBeInTheDocument();
  });
});
