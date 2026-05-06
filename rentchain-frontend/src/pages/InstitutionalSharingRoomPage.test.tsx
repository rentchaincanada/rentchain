import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstitutionalSharingRoomPage from "./InstitutionalSharingRoomPage";

const apiMocks = vi.hoisted(() => ({
  fetchSharingRooms: vi.fn(),
  createSharingRoom: vi.fn(),
  revokeSharingRoom: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/sharingRoomsApi", async () => {
  const actual = await vi.importActual<any>("@/api/sharingRoomsApi");
  return {
    ...actual,
    fetchSharingRooms: apiMocks.fetchSharingRooms,
    createSharingRoom: apiMocks.createSharingRoom,
    revokeSharingRoom: apiMocks.revokeSharingRoom,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: apiMocks.showToast }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function room() {
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
    sharedScopes: [{ scopeKey: "evidence_pack", scopeId: "decision-1", label: "Decision evidence", status: "available", destination: "/evidence-packs", blockedReason: null }],
    redactions: [{ fieldCategory: "payment_account_details", state: "excluded", reason: "Payment account details are excluded." }],
    auditReferences: [{ eventType: "institutional_sharing_room_created", summary: "created", occurredAt: "2026-05-06T00:00:00.000Z" }],
    timelineReferences: [],
    evidenceReferences: [],
  };
}

describe("InstitutionalSharingRoomPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    apiMocks.fetchSharingRooms.mockResolvedValue([room()]);
    apiMocks.createSharingRoom.mockResolvedValue(room());
    apiMocks.revokeSharingRoom.mockResolvedValue({
      ...room(),
      status: "expired",
      accessControls: { ...room().accessControls, status: "revoked" },
    });
  });

  it("renders rooms, creation controls, access scope, and safety copy", async () => {
    render(
      <MemoryRouter>
        <InstitutionalSharingRoomPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Institutional sharing rooms" })).toBeInTheDocument();
    expect(screen.getAllByText(/Institutional sharing remains permissioned and review controlled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sensitive data may be excluded or redacted/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No public sharing or automated submission is enabled/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Create controlled room")).toBeInTheDocument();
    expect(screen.getByText("Decision evidence")).toBeInTheDocument();
    expect(screen.getByText("Payment Account Details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish publicly|make public|auto-submit|auto-share|export unrestricted|mint token|permanent public access/i })).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("creates and revokes rooms through scoped API helpers", async () => {
    render(
      <MemoryRouter>
        <InstitutionalSharingRoomPage />
      </MemoryRouter>
    );

    await screen.findByText("Decision evidence");
    fireEvent.click(screen.getByRole("button", { name: "Review access scope" }));
    expect(apiMocks.createSharingRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomType: "lender_review",
        institutionType: "lender",
        redactionLevel: "strict",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke access" }));
    await waitFor(() => expect(apiMocks.revokeSharingRoom).toHaveBeenCalledWith("room-1"));
  });
});
