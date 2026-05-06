import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NetworkParticipantsPage from "./NetworkParticipantsPage";

const mockFetchNetworkParticipants = vi.fn();
const mockShowToast = vi.fn();

vi.mock("@/api/networkParticipantsApi", () => ({
  fetchNetworkParticipants: (...args: any[]) => mockFetchNetworkParticipants(...args),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const participant = {
  participantId: "network_participant:landlord-1:lender:lender-1",
  participantType: "lender",
  status: "verified",
  manualReviewRequired: true,
  publiclyDiscoverable: false,
  externalRelationshipExecutionEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalRelationships: 1,
    verifiedRelationships: 1,
    partiallyVerifiedRelationships: 0,
    blockedRelationships: 0,
    unavailableRelationships: 0,
    evidenceReferences: 0,
    reviewReferences: 0,
    permissionReferences: 0,
  },
  identityReferences: [],
  relationshipReferences: [],
  reviewReferences: [],
  evidenceReferences: [],
  permissionReferences: [],
  redactions: ["Raw screening and credit bureau payloads are excluded."],
  blockedReasons: [],
  canonicalEvents: [],
};

describe("NetworkParticipantsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNetworkParticipants.mockResolvedValue([participant]);
  });

  it("renders network participants and required safety copy", async () => {
    render(
      <MemoryRouter>
        <NetworkParticipantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Network participants")).toBeInTheDocument();
    expect(screen.getAllByText(/No public discovery or autonomous relationship execution is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Raw screening and credit bureau payloads are excluded.")).toBeInTheDocument();
  });

  it("updates participant filters deterministically", async () => {
    render(
      <MemoryRouter>
        <NetworkParticipantsPage />
      </MemoryRouter>
    );

    await screen.findByText("Network participants");
    fireEvent.change(screen.getByLabelText("Participant type"), { target: { value: "auditor" } });
    fireEvent.change(screen.getByLabelText("Participant reference"), { target: { value: "auditor-1" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "blocked" } });

    await waitFor(() => {
      expect(mockFetchNetworkParticipants).toHaveBeenLastCalledWith({
        participantType: "auditor",
        participantId: "auditor-1",
        status: "blocked",
      });
    });
  });

  it("shows empty state and omits forbidden labels", async () => {
    mockFetchNetworkParticipants.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <NetworkParticipantsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No network participants match these filters.")).toBeInTheDocument();
    expect(screen.queryByText("Public profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish participant")).not.toBeInTheDocument();
    expect(screen.queryByText("Public directory")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-connect")).not.toBeInTheDocument();
    expect(screen.queryByText("Public reputation")).not.toBeInTheDocument();
  });
});
