import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RegulatoryProfilePage from "./RegulatoryProfilePage";

const mockFetchRegulatoryProfiles = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/regulatoryProfileApi", () => ({
  fetchRegulatoryProfiles: (...args: any[]) => mockFetchRegulatoryProfiles(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const profile = {
  regulatoryProfileId: "regulatory_profile:landlord-1:ca:ns:halifax",
  jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
  status: "partially_ready",
  manualReviewRequired: true,
  legalCertificationEnabled: false,
  externalRegulatorSubmissionEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalReferences: 1,
    verifiedReferences: 0,
    partiallyReadyReferences: 1,
    blockedReferences: 0,
    unavailableReferences: 0,
    restrictions: 1,
  },
  registryReferences: [],
  screeningReadiness: [],
  privacyReadiness: [],
  sharingRestrictions: [],
  settlementRestrictions: [],
  exportRestrictions: [],
  auditReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  redactions: ["Raw screening and credit bureau payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("RegulatoryProfilePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchRegulatoryProfiles.mockResolvedValue([profile]);
  });

  it("renders regulatory profiles and required safety copy", async () => {
    render(
      <MemoryRouter>
        <RegulatoryProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Regulatory profiles")).toBeInTheDocument();
    expect(screen.getAllByText(/No legal certification or regulator submission is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Raw screening and credit bureau payloads are excluded.")).toBeInTheDocument();
  });

  it("updates deterministic jurisdiction and status filters", async () => {
    render(
      <MemoryRouter>
        <RegulatoryProfilePage />
      </MemoryRouter>
    );

    await screen.findByText("Regulatory profiles");
    fireEvent.change(screen.getByLabelText("Province"), { target: { value: "NS" } });
    fireEvent.change(screen.getByLabelText("Municipality"), { target: { value: "Halifax" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchRegulatoryProfiles).toHaveBeenLastCalledWith({
        country: "CA",
        province: "NS",
        municipality: "Halifax",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchRegulatoryProfiles.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RegulatoryProfilePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No regulatory profiles match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Certify compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit to regulator")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-file")).not.toBeInTheDocument();
    expect(screen.queryByText("Legal approval")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous compliance")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish compliance")).not.toBeInTheDocument();
  });
});
