import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialActivityPanel } from "./FinancialActivityPanel";
import type { FinancialProjectionRow } from "@/api/tenantDetail";

const rows: FinancialProjectionRow[] = [
  {
    id: "row-1",
    sourceType: "recorded_payment",
    sourceId: "payment-1",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    propertyLabel: "Harbour View",
    unitLabel: "101",
    amount: 1850,
    direction: "credit",
    occurredAt: "2026-04-03T10:00:00.000Z",
    displayLabel: "Recorded payment (e-transfer)",
    sourceBadge: "Recorded payment",
  },
  {
    id: "row-2",
    sourceType: "ledger_payment_unmatched",
    sourceId: "ledger-2",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    propertyId: null,
    unitId: null,
    propertyLabel: null,
    unitLabel: null,
    amount: 1850,
    direction: "credit",
    occurredAt: "2026-04-02T10:00:00.000Z",
    displayLabel: "Lease ledger payment (cash)",
    sourceBadge: "Lease ledger payment",
  },
  {
    id: "row-3",
    sourceType: "lease_charge",
    sourceId: "ledger-1",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    propertyLabel: "Harbour View",
    unitLabel: "101",
    amount: 1850,
    direction: "debit",
    occurredAt: "2026-04-01T10:00:00.000Z",
    displayLabel: "Rent charge",
    sourceBadge: "Lease charge",
  },
  {
    id: "row-4",
    sourceType: "lease_credit",
    sourceId: "ledger-3",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    propertyId: "property-1",
    unitId: "unit-1",
    propertyLabel: "Harbour View",
    unitLabel: "101",
    amount: 50,
    direction: "credit",
    occurredAt: "2026-03-31T10:00:00.000Z",
    displayLabel: "Lease credit",
    sourceBadge: "Lease credit",
  },
];

describe("FinancialActivityPanel", () => {
  it("groups rows by source type with clear badge labels", () => {
    render(<FinancialActivityPanel rows={rows} loading={false} error={null} />);

    expect(screen.getByText("Financial activity")).toBeInTheDocument();
    expect(screen.getByText("Recorded Payments")).toBeInTheDocument();
    expect(screen.getByText("Lease Charges")).toBeInTheDocument();
    expect(screen.getByText("Lease Credits")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Ledger Payments")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Lease Charge")).toBeInTheDocument();
    expect(screen.getByText("Credit")).toBeInTheDocument();
    expect(screen.getByText("Unmatched Ledger Entry")).toBeInTheDocument();
    expect(screen.getAllByText("Harbour View • Unit 101").length).toBeGreaterThan(0);
  });

  it("renders loading, error, and empty states without raw ids", () => {
    const { rerender } = render(<FinancialActivityPanel rows={[]} loading={true} error={null} />);
    expect(screen.getByText("Loading financial activity...")).toBeInTheDocument();

    rerender(<FinancialActivityPanel rows={[]} loading={false} error={"boom"} />);
    expect(screen.getByText("Could not load financial activity.")).toBeInTheDocument();

    rerender(<FinancialActivityPanel rows={[]} loading={false} error={null} />);
    expect(screen.getByText("No financial activity is available for this tenant yet.")).toBeInTheDocument();
    expect(screen.queryByText("property-1")).not.toBeInTheDocument();
    expect(screen.queryByText("unit-1")).not.toBeInTheDocument();
  });
});
