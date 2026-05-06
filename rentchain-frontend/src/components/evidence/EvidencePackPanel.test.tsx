import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EvidencePackPanel } from "./EvidencePackPanel";

function evidencePack(overrides: Record<string, any> = {}) {
  return {
    evidencePackId: "evidence_pack:decision:landlord-1:decision-1",
    scope: "decision",
    scopeId: "decision-1",
    status: "incomplete",
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    generatedAt: "2026-05-05T12:00:00.000Z",
    summary: { totalItems: 2, includedItems: 1, redactedItems: 1, blockedItems: 0, missingItems: 1 },
    sections: [
      {
        sectionKey: "decision_lineage",
        label: "Decision lineage",
        status: "included",
        itemsCount: 1,
        items: [{
          evidenceItemId: "item-1",
          itemType: "decision",
          label: "Review missing payment",
          description: "Expected rent payment is missing.",
          status: "included",
          source: "decision_inbox",
          sourceId: "decision-1",
          destination: "/leases/lease-1/ledger",
          timestamp: "2026-05-05T12:00:00.000Z",
          redacted: false,
          redactionReason: null,
          blockedReason: null,
        }],
        missingEvidence: [],
        blockedReasons: [],
      },
      {
        sectionKey: "audit_events",
        label: "Audit events",
        status: "incomplete",
        itemsCount: 0,
        items: [],
        missingEvidence: ["No landlord-scoped canonical events were available for this scope."],
        blockedReasons: [],
      },
    ],
    redactions: [{ fieldCategory: "payment_account_details", reason: "Payment account details are excluded." }],
    blockedReasons: [],
    disclaimers: [
      "Preview only. Evidence is not shared externally.",
      "Manual review is required before relying on or sharing this evidence.",
      "Sensitive data may be excluded or redacted.",
    ],
    ...overrides,
  };
}

describe("EvidencePackPanel", () => {
  afterEach(() => cleanup());

  it("renders status, sections, redactions, missing evidence, and safe links", () => {
    render(
      <MemoryRouter>
        <EvidencePackPanel evidencePack={evidencePack() as any} />
      </MemoryRouter>
    );

    expect(screen.getByText("Evidence details")).toBeInTheDocument();
    expect(screen.getAllByText(/Preview only\. Evidence is not shared externally\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review is required before relying on or sharing this evidence\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sensitive data may be excluded or redacted\./i).length).toBeGreaterThan(0);
    expect(screen.getByText("Total items")).toBeInTheDocument();
    expect(screen.getByText("Decision lineage")).toBeInTheDocument();
    expect(screen.getByText("Review missing payment")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("link", { name: "View timeline" })).toHaveAttribute(
      "href",
      "/review-timeline?scope=evidence_pack&scopeId=evidence_pack%3Adecision%3Alandlord-1%3Adecision-1"
    );
    expect(screen.getByText(/Missing evidence: No landlord-scoped canonical events/i)).toBeInTheDocument();
    expect(screen.getByText("Payment Account Details")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit|send|share externally|certify|file|upload|auto-report|legal approval/i })).not.toBeInTheDocument();
  });
});
