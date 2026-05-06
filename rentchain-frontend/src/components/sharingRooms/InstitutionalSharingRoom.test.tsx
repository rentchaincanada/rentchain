import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstitutionalSharingRoom } from "./InstitutionalSharingRoom";
import type { InstitutionalSharingRoom as SharingRoom } from "@/api/sharingRoomsApi";

function room(overrides: Partial<SharingRoom> = {}): SharingRoom {
  return {
    sharingRoomId: "room-1",
    roomType: "lender_review",
    status: "review_required",
    manualReviewRequired: true,
    publiclyAccessible: false,
    externalExecutionEnabled: false,
    tokenizationEnabled: false,
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
    expiresAt: "2026-05-20T00:00:00.000Z",
    accessControls: {
      accessControlId: "access-1",
      accessType: "view_only",
      institutionType: "lender",
      status: "pending_review",
      manualApprovalRequired: true,
      publicAccess: false,
      downloadEnabled: false,
      externalSubmissionEnabled: false,
      allowedScopes: ["evidence_pack"],
      redactionLevel: "strict",
      expiresAt: "2026-05-20T00:00:00.000Z",
    },
    sharedScopes: [
      {
        scopeKey: "evidence_pack",
        scopeId: "decision-1",
        label: "Decision evidence",
        status: "available",
        destination: "/evidence-packs?scope=decision&scopeId=decision-1",
        blockedReason: null,
      },
    ],
    redactions: [
      {
        fieldCategory: "payment_account_details",
        state: "excluded",
        reason: "Payment account details are excluded.",
      },
    ],
    auditReferences: [
      {
        eventType: "institutional_sharing_room_created",
        summary: "created",
        occurredAt: "2026-05-06T00:00:00.000Z",
      },
    ],
    timelineReferences: [],
    evidenceReferences: [],
    ...overrides,
  };
}

describe("InstitutionalSharingRoom", () => {
  afterEach(() => cleanup());

  it("renders access controls, redactions, audit lineage, and safety copy", () => {
    const onRevoke = vi.fn();
    render(
      <MemoryRouter>
        <InstitutionalSharingRoom room={room()} onRevoke={onRevoke} />
      </MemoryRouter>
    );

    expect(screen.getByText("View sharing room")).toBeInTheDocument();
    expect(screen.getByText("Lender Review")).toBeInTheDocument();
    expect(screen.getByText(/Institutional sharing remains permissioned and review controlled/i)).toBeInTheDocument();
    expect(screen.getByText(/Sensitive data may be excluded or redacted/i)).toBeInTheDocument();
    expect(screen.getByText(/No public sharing or automated submission is enabled/i)).toBeInTheDocument();
    expect(screen.getByText("View Only")).toBeInTheDocument();
    expect(screen.getByText("Decision evidence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View evidence" })).toHaveAttribute(
      "href",
      "/evidence-packs?scope=decision&scopeId=decision-1"
    );
    expect(screen.getByText("Payment Account Details")).toBeInTheDocument();
    expect(screen.getByText("Institutional Sharing Room Created")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke access" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish publicly|make public|auto-submit|auto-share|export unrestricted|mint token|permanent public access/i })).not.toBeInTheDocument();
  });
});
