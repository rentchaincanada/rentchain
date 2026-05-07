import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CrossOrganizationTrustPage from "./CrossOrganizationTrustPage";

const mockFetchCrossOrganizationTrustRelationships = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/crossOrganizationTrustApi", () => ({
  fetchCrossOrganizationTrustRelationships: (...args: any[]) => mockFetchCrossOrganizationTrustRelationships(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const trustRelationship = {
  trustRelationshipId: "cross_organization_trust:landlord-1:operational_trust",
  relationshipType: "operational_trust",
  status: "verified",
  manualReviewRequired: true,
  publicTrustExposureEnabled: false,
  autonomousTrustApprovalEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 1,
    partiallyVerifiedReferences: 0,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 0,
  },
  participantReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  settlementReferences: [],
  regulatoryReferences: [],
  sharingReferences: [],
  auditReferences: [],
  operationalReferences: [],
  trustRestrictions: [],
  redactions: ["Public reputation scores and participant rankings are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("CrossOrganizationTrustPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCrossOrganizationTrustRelationships.mockResolvedValue([trustRelationship]);
  });

  it("renders trust relationships and required safety copy", async () => {
    render(
      <MemoryRouter>
        <CrossOrganizationTrustPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Cross-organization trust")).toBeInTheDocument();
    expect(screen.getAllByText(/No public trust exposure or autonomous trust approval is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Public reputation scores and participant rankings are excluded.")).toBeInTheDocument();
  });

  it("updates deterministic relationship and status filters", async () => {
    render(
      <MemoryRouter>
        <CrossOrganizationTrustPage />
      </MemoryRouter>
    );

    await screen.findByText("Cross-organization trust");
    fireEvent.change(screen.getByLabelText("Relationship type"), { target: { value: "settlement_trust" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchCrossOrganizationTrustRelationships).toHaveBeenLastCalledWith({
        relationshipType: "settlement_trust",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchCrossOrganizationTrustRelationships.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <CrossOrganizationTrustPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No cross-organization trust relationships match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Public trust score")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-approve trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Public ranking")).not.toBeInTheDocument();
    expect(screen.queryByText("Reputation marketplace")).not.toBeInTheDocument();
  });
});
