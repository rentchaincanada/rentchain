import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicExposureHardeningPage from "./PublicExposureHardeningPage";

const mockFetchPublicExposureHardeningProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/publicExposureHardeningApi", () => ({
  fetchPublicExposureHardeningProfiles: (...args: any[]) => mockFetchPublicExposureHardeningProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  publicExposureHardeningId: "public_exposure_hardening:controlled-production-exposure-readiness-v1",
  status: "ready_for_review",
  manualApprovalRequired: true,
  autonomousLaunchEnabled: false,
  autonomousRollbackEnabled: false,
  publicExposureEnabled: false,
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
  rollbackReferences: [],
  securityReferences: [],
  operationalRiskReferences: [],
  onboardingReferences: [],
  supportReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  auditReferences: [],
  publicExposureRestrictions: [],
  redactions: ["Public exposure hardening is readiness metadata only; no autonomous deployment, rollback, or public launch execution is enabled."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("PublicExposureHardeningPage", () => {
  const forbiddenLabels = [
    ["Launch", "automatically"],
    ["Auto", "rollback"],
    ["Enable", "production"],
    ["Autonomous", "launch"],
    ["Auto", "approve launch"],
    ["Trigger", "production exposure"],
  ].map((parts) => (parts[0] === "Auto" ? parts.join("-") : parts.join(" ")));

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchPublicExposureHardeningProfiles.mockResolvedValue([profile]);
  });

  it("renders public exposure hardening and required safety copy", async () => {
    render(
      <MemoryRouter>
        <PublicExposureHardeningPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Public exposure hardening")).toBeInTheDocument();
    expect(screen.getAllByText(/No autonomous deployment, rollback, or public launch execution is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Manual approval required")).toBeInTheDocument();
    expect(screen.getByText("Public exposure hardening is readiness metadata only; no autonomous deployment, rollback, or public launch execution is enabled.")).toBeInTheDocument();
  });

  it("updates deterministic status filters", async () => {
    render(
      <MemoryRouter>
        <PublicExposureHardeningPage />
      </MemoryRouter>
    );

    await screen.findByText("Public exposure hardening");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchPublicExposureHardeningProfiles).toHaveBeenLastCalledWith({
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchPublicExposureHardeningProfiles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <PublicExposureHardeningPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No public exposure hardening profiles match these filters.")).toBeInTheDocument();
    for (const forbiddenLabel of forbiddenLabels) {
      expect(screen.queryByText(forbiddenLabel)).not.toBeInTheDocument();
    }
  });
});
