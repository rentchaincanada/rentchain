import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CanonicalReviewTimeline } from "./CanonicalReviewTimeline";

function timeline(overrides: Record<string, any> = {}) {
  return {
    timelineId: "canonical_review_timeline:decision:landlord-1:decision-1",
    scope: "decision",
    scopeId: "decision-1",
    generatedAt: "2026-05-05T12:00:00.000Z",
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    summary: { total: 2, reviewRequired: 1, blocked: 0, completed: 0, redacted: 1 },
    filters: { entryType: ["decision", "redaction_note"], status: ["review_required", "redacted"], source: ["decision_inbox", "evidence_packs"] },
    entries: [
      {
        timelineEntryId: "entry-1",
        entryType: "decision",
        timestamp: "2026-05-05T12:00:00.000Z",
        label: "Review overdue rent",
        description: "Rent is overdue.",
        status: "review_required",
        actor: { type: "system", id: null },
        source: "decision_inbox",
        sourceId: "decision-1",
        destination: "/leases/lease-1/ledger",
        redacted: false,
        redactionReason: null,
        blockedReason: null,
        manualOnly: true,
      },
      {
        timelineEntryId: "entry-2",
        entryType: "redaction_note",
        timestamp: "2026-05-05T12:01:00.000Z",
        label: "Redaction applied",
        description: "Payment account details are excluded.",
        status: "redacted",
        actor: { type: "system", id: null },
        source: "evidence_packs",
        sourceId: "evidence-1",
        destination: null,
        redacted: true,
        redactionReason: "Payment account details are excluded.",
        blockedReason: null,
        manualOnly: true,
      },
    ],
    ...overrides,
  };
}

describe("CanonicalReviewTimeline", () => {
  afterEach(() => cleanup());

  it("renders timeline entries, badges, actors, redactions, safety copy, and safe links", () => {
    render(
      <MemoryRouter>
        <CanonicalReviewTimeline timeline={timeline() as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("Canonical review timeline")).toBeInTheDocument();
    expect(screen.getAllByText(/Read-only operational review timeline/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No automated approval or certification occurs/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Review overdue rent")).toBeInTheDocument();
    expect(screen.getByText("Review Required")).toBeInTheDocument();
    expect(screen.getByText("Redaction Note")).toBeInTheDocument();
    expect(screen.getAllByText("Payment account details are excluded.").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.queryByRole("button", { name: /approve|certify|auto-resolve|submit|file|legal approval|auto-report/i })).not.toBeInTheDocument();
  });
});
