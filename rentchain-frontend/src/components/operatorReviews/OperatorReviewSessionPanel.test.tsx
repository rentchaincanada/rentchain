import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperatorReviewSessionPanel } from "./OperatorReviewSessionPanel";

const apiMocks = vi.hoisted(() => ({
  fetchOperatorReviewSessions: vi.fn(),
  openOperatorReviewSession: vi.fn(),
  addOperatorReviewNote: vi.fn(),
  closeOperatorReviewSession: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/api/operatorReviewApi", async () => {
  const actual = await vi.importActual<any>("@/api/operatorReviewApi");
  return {
    ...actual,
    fetchOperatorReviewSessions: apiMocks.fetchOperatorReviewSessions,
    openOperatorReviewSession: apiMocks.openOperatorReviewSession,
    addOperatorReviewNote: apiMocks.addOperatorReviewNote,
    closeOperatorReviewSession: apiMocks.closeOperatorReviewSession,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: apiMocks.showToast }),
}));

function session(overrides: Record<string, any> = {}) {
  return {
    reviewSessionId: "operator_review:landlord-1:decision:decision-1",
    landlordId: "landlord-1",
    scope: "decision",
    scopeId: "decision-1",
    status: "open",
    openedAt: "2026-05-05T12:00:00.000Z",
    closedAt: null,
    openedBy: { userId: "landlord-1", role: "landlord", email: "landlord@example.com" },
    outcome: null,
    notes: [],
    linkedEvidence: [{ evidenceId: "decision-1", label: "Decision evidence", kind: "decision", destination: "/decision-inbox" }],
    manualOnly: true,
    systemGenerated: false,
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("OperatorReviewSessionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchOperatorReviewSessions.mockResolvedValue([]);
    apiMocks.openOperatorReviewSession.mockResolvedValue(session());
    apiMocks.addOperatorReviewNote.mockResolvedValue(session({
      notes: [{ noteId: "note-1", text: "Reviewed evidence", createdAt: "2026-05-05T12:01:00.000Z", actor: { userId: "landlord-1", role: "landlord" } }],
      updatedAt: "2026-05-05T12:01:00.000Z",
    }));
    apiMocks.closeOperatorReviewSession.mockResolvedValue(session({
      status: "completed",
      closedAt: "2026-05-05T12:02:00.000Z",
      outcome: {
        result: "reviewed",
        summary: "Reviewed by operator",
        recordedAt: "2026-05-05T12:02:00.000Z",
        recordedBy: { userId: "landlord-1", role: "landlord" },
      },
      updatedAt: "2026-05-05T12:02:00.000Z",
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("opens a review session and shows required safety copy", async () => {
    render(
      <MemoryRouter>
        <OperatorReviewSessionPanel scope="decision" scopeId="decision-1" linkedEvidence={[]} />
      </MemoryRouter>
    );

    expect(await screen.findByText("Operator review session")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View evidence pack" })).toHaveAttribute(
      "href",
      "/evidence-packs?scope=decision&scopeId=decision-1"
    );
    expect(screen.getByText(/Manual operator review/i)).toBeInTheDocument();
    expect(screen.getByText(/Review sessions are audit logged/i)).toBeInTheDocument();
    expect(screen.getByText(/No automated approval or certification occurs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open review" }));

    await waitFor(() => {
      expect(apiMocks.openOperatorReviewSession).toHaveBeenCalledWith({
        scope: "decision",
        scopeId: "decision-1",
        linkedEvidence: [],
      });
    });
    expect(await screen.findByRole("button", { name: "Record outcome" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve|certify|auto-resolve|file|submit to regulator|legal approval/i })).not.toBeInTheDocument();
  });

  it("adds notes and records outcomes for active sessions", async () => {
    apiMocks.fetchOperatorReviewSessions.mockResolvedValue([session()]);

    render(
      <MemoryRouter>
        <OperatorReviewSessionPanel
          scope="decision"
          scopeId="decision-1"
          linkedEvidence={[{ evidenceId: "decision-1", label: "Decision evidence", kind: "decision", destination: "/decision-inbox" }]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: "Add note" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Reviewed evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));

    await waitFor(() => {
      expect(apiMocks.addOperatorReviewNote).toHaveBeenCalledWith(
        "operator_review:landlord-1:decision:decision-1",
        "Reviewed evidence"
      );
    });

    fireEvent.change(screen.getByLabelText("Outcome"), { target: { value: "reviewed" } });
    fireEvent.change(screen.getByLabelText("Outcome summary"), { target: { value: "Reviewed by operator" } });
    fireEvent.click(screen.getByRole("button", { name: "Record outcome" }));

    await waitFor(() => {
      expect(apiMocks.closeOperatorReviewSession).toHaveBeenCalledWith(
        "operator_review:landlord-1:decision:decision-1",
        expect.objectContaining({ result: "reviewed", summary: "Reviewed by operator" })
      );
    });
  });
});
