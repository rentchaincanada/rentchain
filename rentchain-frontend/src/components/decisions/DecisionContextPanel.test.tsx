import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { DecisionContextPanel } from "./DecisionContextPanel";
import type { DecisionItem } from "@/lib/decisions/decisionDisplay";

const baseDecision: DecisionItem = {
  decisionId: "decision-1",
  leaseId: "lease-1",
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  paymentIntentId: "pi-1",
  rentPaymentId: "rp-1",
  decisionType: "review_overdue_rent",
  severity: "critical",
  status: "reviewed",
  reason: "Rent past due date",
  metadata: {
    signalType: "overdue",
    outstandingAmountCents: 145000,
    obligationStatus: "missing",
  },
  latestAction: {
    actionId: "action-1",
    decisionId: "decision-1",
    actionType: "reviewed",
    nextStatus: "reviewed",
    actorEmail: "admin@example.com",
    createdAt: "2026-05-05T12:00:00.000Z",
  },
};

describe("DecisionContextPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders context links, evidence, and review workflow trail", () => {
    render(
      <MemoryRouter>
        <DecisionContextPanel decision={baseDecision} includeAdminReviewLink />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Lease summary" })).toHaveAttribute("href", "/leases/lease-1/summary");
    expect(screen.getByRole("link", { name: "Lease ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("link", { name: "Property / unit" })).toHaveAttribute("href", "/properties?propertyId=property-1&unitId=unit-1");
    expect(screen.getByRole("link", { name: "Tenant" })).toHaveAttribute("href", "/tenants?tenantId=tenant-1");
    expect(screen.getByRole("link", { name: "Lifecycle review" })).toHaveAttribute("href", "/admin/lease-lifecycle-review");
    expect(screen.getByText("Decision reason")).toBeInTheDocument();
    expect(screen.getByText("Rent past due date")).toBeInTheDocument();
    expect(screen.getByText("$1,450.00")).toBeInTheDocument();
    expect(screen.getByText("Review workflow trail")).toBeInTheDocument();
    expect(screen.getByText("Tracks operational review actions only.")).toBeInTheDocument();
    expect(screen.getByText(/Workflow status:/)).toBeInTheDocument();
    expect(screen.getByText(/Last action:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fix/i })).not.toBeInTheDocument();
  });

  it("renders graceful fallback when no context identifiers exist", () => {
    render(
      <MemoryRouter>
        <DecisionContextPanel decision={{ ...baseDecision, leaseId: null, propertyId: null, unitId: null, tenantId: null }} />
      </MemoryRouter>
    );

    expect(screen.getByText("Context unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lease ledger" })).not.toBeInTheDocument();
  });
});
