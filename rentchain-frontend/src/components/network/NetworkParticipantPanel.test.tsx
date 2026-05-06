import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NetworkParticipantPanel } from "./NetworkParticipantPanel";

const participant = {
  participantId: "network_participant:landlord-1:lender:lender-1",
  participantType: "lender",
  status: "partially_verified",
  manualReviewRequired: true,
  publiclyDiscoverable: false,
  externalRelationshipExecutionEnabled: false,
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: {
    totalRelationships: 2,
    verifiedRelationships: 1,
    partiallyVerifiedRelationships: 1,
    blockedRelationships: 0,
    unavailableRelationships: 0,
    evidenceReferences: 1,
    reviewReferences: 1,
    permissionReferences: 1,
  },
  identityReferences: [
    {
      referenceId: "identity:lender-1",
      referenceType: "identity",
      label: "Identity lineage reference",
      status: "available",
      destination: "/identity-layer",
      occurredAt: null,
      redacted: false,
      blockedReason: null,
    },
  ],
  relationshipReferences: [
    {
      relationshipId: "sharing:room-1",
      relationshipType: "sharing_relationship",
      status: "partially_verified",
      label: "Institutional sharing relationship",
      description: "Sharing-room metadata is available as a controlled relationship reference.",
      reviewRequired: true,
      participantReferences: ["room-1"],
      evidenceLineage: ["evidence-1"],
      reviewLineage: ["review-1"],
      permissionReferences: ["permission-1"],
      destination: "/institutional-sharing-rooms",
      redacted: false,
      redactionReason: null,
      blockedReason: "Manual relationship review remains required.",
    },
  ],
  reviewReferences: [],
  evidenceReferences: [],
  permissionReferences: [],
  redactions: ["Payment account details and unrestricted financial information are excluded."],
  blockedReasons: ["Manual relationship review remains required."],
  canonicalEvents: [],
} as const;

describe("NetworkParticipantPanel", () => {
  it("renders participant relationships, lineage, blocked reasons, and safety copy", () => {
    render(
      <MemoryRouter>
        <NetworkParticipantPanel participant={participant as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("View participant")).toBeInTheDocument();
    expect(screen.getByText(/Network participants are permissioned operational actors/i)).toBeInTheDocument();
    expect(screen.getByText("View relationships")).toBeInTheDocument();
    expect(screen.getByText("View evidence lineage: 1")).toBeInTheDocument();
    expect(screen.getByText("View review lineage: 1")).toBeInTheDocument();
    expect(screen.getByText("View blocked reason: Manual relationship review remains required.")).toBeInTheDocument();
    expect(screen.getByText("Payment account details and unrestricted financial information are excluded.")).toBeInTheDocument();
  });

  it("does not render forbidden public-network labels", () => {
    render(
      <MemoryRouter>
        <NetworkParticipantPanel participant={participant as any} />
      </MemoryRouter>
    );

    expect(screen.queryByText("Public profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish participant")).not.toBeInTheDocument();
    expect(screen.queryByText("Public directory")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous trust")).not.toBeInTheDocument();
    expect(screen.queryByText("Auto-connect")).not.toBeInTheDocument();
    expect(screen.queryByText("Public reputation")).not.toBeInTheDocument();
  });
});
