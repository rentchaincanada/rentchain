import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaseLedgerPage from "./LeaseLedgerPage";

const mocks = vi.hoisted(() => ({
  fetchLeaseLedger: vi.fn(),
  addLeaseCharge: vi.fn(),
  addLeasePayment: vi.fn(),
  leaseLedgerExportUrl: vi.fn((_leaseId: string, _from?: string, _to?: string, format: "csv" | "pdf" = "csv") => `https://example.com/export.${format}`),
  getLeaseById: vi.fn(),
  getLeaseNotes: vi.fn(),
  createLeaseNote: vi.fn(),
  archiveLeaseRecord: vi.fn(),
  restoreLeaseRecord: vi.fn(),
}));

vi.mock("../api/leaseLedgerApi", () => ({
  fetchLeaseLedger: mocks.fetchLeaseLedger,
  addLeaseCharge: mocks.addLeaseCharge,
  addLeasePayment: mocks.addLeasePayment,
  leaseLedgerExportUrl: mocks.leaseLedgerExportUrl,
}));

vi.mock("@/api/leasesApi", () => ({
  getLeaseById: mocks.getLeaseById,
  getLeaseNotes: mocks.getLeaseNotes,
  createLeaseNote: mocks.createLeaseNote,
  archiveLeaseRecord: mocks.archiveLeaseRecord,
  restoreLeaseRecord: mocks.restoreLeaseRecord,
}));

vi.mock("../lib/authToken", () => ({
  getAuthToken: () => null,
}));

vi.mock("../lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: async () => null,
}));

describe("LeaseLedgerPage", () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mocks.leaseLedgerExportUrl.mockImplementation(
      (_leaseId: string, _from?: string, _to?: string, format: "csv" | "pdf" = "csv") => `https://example.com/export.${format}`
    );
    global.URL.createObjectURL = vi.fn(() => "blob:lease-ledger");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    })) as unknown as typeof fetch;
    mocks.fetchLeaseLedger.mockResolvedValue({
      ok: true,
      leaseId: "lease-1",
      entries: [
        {
          id: "entry-1",
          leaseId: "lease-1",
          entryType: "charge",
          category: "rent",
          amountCents: 145000,
          effectiveDate: "2026-04-01",
          createdAt: 1,
          signedAmountCents: 145000,
          balanceCents: 145000,
        },
        {
          id: "entry-2",
          leaseId: "lease-1",
          entryType: "payment",
          category: "rent",
          amountCents: 10000,
          effectiveDate: "2026-04-05",
          createdAt: 2,
          signedAmountCents: -10000,
          balanceCents: 135000,
        },
      ],
      totals: { chargesCents: 145000, paymentsCents: 10000, balanceCents: 135000 },
      monthlyTotals: {
        "2026-04": { chargesCents: 145000, paymentsCents: 10000, netCents: 135000 },
      },
      obligationRows: [
        {
          rowId: "obligation-paid",
          leaseId: "lease-1",
          paymentIntentId: "pi-paid",
          rentPaymentId: "rp-paid",
          propertyId: "prop-1",
          unitId: "unit-1",
          tenantId: "tenant-1",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          dueDate: "2026-04-01",
          expectedAmountCents: 145000,
          paidAmountCents: 145000,
          currency: "cad",
          obligationStatus: "paid",
          paymentIntentStatus: "confirmed",
          rentPaymentStatus: "paid",
          reconciliationStatus: "reconciled",
          evidenceStatus: "reconciled",
          source: "reconciliation",
          reasons: ["paid_amount_matches_expected"],
        },
        {
          rowId: "obligation-underpaid",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 10000,
          currency: "cad",
          obligationStatus: "underpaid",
          evidenceStatus: "provider_received",
          source: "rent_payment",
          reasons: ["paid_amount_below_expected"],
        },
        {
          rowId: "obligation-overpaid",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 150000,
          currency: "cad",
          obligationStatus: "overpaid",
          evidenceStatus: "provider_received",
          source: "rent_payment",
          reasons: ["paid_amount_above_expected"],
        },
        {
          rowId: "obligation-missing",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "missing",
          evidenceStatus: "none",
          source: "lease_lifecycle",
          reasons: ["expected_payment_missing"],
        },
        {
          rowId: "obligation-pending",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "pending",
          paymentIntentStatus: "pending_settlement",
          evidenceStatus: "pending",
          source: "payment_intent",
          reasons: ["payment_pending"],
        },
        {
          rowId: "obligation-failed",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "failed",
          evidenceStatus: "failed",
          source: "rent_payment",
          reasons: ["rent_payment_failed"],
        },
        {
          rowId: "obligation-manual-review",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 145000,
          paidAmountCents: 145000,
          currency: "cad",
          obligationStatus: "manual_review_required",
          evidenceStatus: "manual_review_required",
          reconciliationStatus: "mismatch",
          source: "reconciliation",
          reasons: ["amount_mismatch"],
        },
        {
          rowId: "obligation-unknown",
          leaseId: "lease-1",
          propertyId: "prop-1",
          expectedAmountCents: 0,
          paidAmountCents: 0,
          currency: "cad",
          obligationStatus: "unknown",
          evidenceStatus: "none",
          source: "payment_intent",
          reasons: ["missing_expected_amount"],
        },
      ],
      obligationSummary: {
        totalRows: 8,
        expectedAmountCents: 1015000,
        paidAmountCents: 595000,
        outstandingAmountCents: 420000,
        manualReviewCount: 1,
        statusCounts: {
          expected: 0,
          pending: 1,
          paid: 1,
          underpaid: 1,
          overpaid: 1,
          failed: 1,
          missing: 1,
          manual_review_required: 1,
          unknown: 1,
        },
      },
    });
    mocks.getLeaseById.mockResolvedValue({
      lease: {
        id: "lease-1",
        propertyName: "Harbour View",
        unitNumber: "101",
        tenantName: "Jane Tenant",
        status: "renewal_pending",
        leaseExecution: {
          executionStatus: "ready_for_landlord_signature",
          executionLabel: "Waiting for landlord signature",
          executionDescription: "Tenant signing appears complete and the next visible execution step belongs to the landlord.",
          requiredNextAction: "landlord_signature",
          tenantSignatureStatus: "completed",
          landlordSignatureStatus: "needed",
          pdfStatus: "generated",
          completedAt: null,
        },
      },
    });
    mocks.getLeaseNotes.mockResolvedValue({
      ok: true,
      notes: [{ id: "note-1", leaseId: "lease-1", landlordId: "landlord-1", note: "Call tenant next week", createdAt: 1 }],
    });
    mocks.createLeaseNote.mockResolvedValue({
      ok: true,
      note: { id: "note-2", leaseId: "lease-1", landlordId: "landlord-1", note: "New note", createdAt: 2 },
    });
    mocks.archiveLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1", archivedAt: "2026-04-01T00:00:00.000Z" } });
    mocks.restoreLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1", archivedAt: null } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads canonical lease detail and notes with the ledger", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbour View · Unit 101")).toBeInTheDocument();
    expect(screen.getByText(/Renewal pending/i)).toBeInTheDocument();
    expect(screen.getByText("Waiting for landlord signature")).toBeInTheDocument();
    expect(screen.getByText("Call tenant next week")).toBeInTheDocument();
  });

  it("formats ledger cents as readable dollars and cents", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbour View · Unit 101")).toBeInTheDocument();
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("+$1,450.00")).toBeInTheDocument();
    expect(screen.getByText("-$100.00")).toBeInTheDocument();
    expect(screen.queryByText("145000")).not.toBeInTheDocument();
    expect(screen.queryByText("10000")).not.toBeInTheDocument();
  });

  it("renders read-only obligation summary and rows with dollar amounts and status badges", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Payment obligations")).toBeInTheDocument();
    expect(screen.getByText("Read-only view of expected rent, execution records, and reconciliation evidence.")).toBeInTheDocument();
    expect(screen.getAllByText("Expected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual Review")).toBeInTheDocument();
    expect(screen.getByText("$10,150.00")).toBeInTheDocument();
    expect(screen.getByText("$5,950.00")).toBeInTheDocument();
    expect(screen.getByText("$4,200.00")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1,350.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,500.00")).toBeInTheDocument();
    expect(screen.queryByText("1015000")).not.toBeInTheDocument();
    expect(screen.queryByText("595000")).not.toBeInTheDocument();
    expect(screen.queryByText("420000")).not.toBeInTheDocument();
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Underpaid")).toBeInTheDocument();
    expect(screen.getByText("Overpaid")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getAllByText("Reconciled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review Required").length).toBeGreaterThan(0);
  });

  it("renders an empty obligation state while preserving existing ledger entries", async () => {
    mocks.fetchLeaseLedger.mockResolvedValueOnce({
      ok: true,
      leaseId: "lease-1",
      entries: [
        {
          id: "entry-1",
          leaseId: "lease-1",
          entryType: "charge",
          category: "rent",
          amountCents: 145000,
          effectiveDate: "2026-04-01",
          createdAt: 1,
          signedAmountCents: 145000,
          balanceCents: 145000,
        },
      ],
      totals: { chargesCents: 145000, paymentsCents: 0, balanceCents: 145000 },
      monthlyTotals: {},
      obligationRows: [],
      obligationSummary: {
        totalRows: 0,
        expectedAmountCents: 0,
        paidAmountCents: 0,
        outstandingAmountCents: 0,
        manualReviewCount: 0,
        statusCounts: {
          expected: 0,
          pending: 0,
          paid: 0,
          underpaid: 0,
          overpaid: 0,
          failed: 0,
          missing: 0,
          manual_review_required: 0,
          unknown: 0,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Obligation ledger is not available yet for this lease.")).toBeInTheDocument();
    expect(screen.getByText("+$1,450.00")).toBeInTheDocument();
    expect(screen.getAllByText("$1,450.00").length).toBeGreaterThan(0);
  });

  it("exports the lease ledger as a PDF download", async () => {
    const realCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") createdAnchors.push(element as HTMLAnchorElement);
      return element;
    });

    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Harbour View · Unit 101");
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    await waitFor(() => {
      expect(mocks.leaseLedgerExportUrl).toHaveBeenCalledWith("lease-1", undefined, undefined, "pdf");
      expect(global.fetch).toHaveBeenCalledWith("https://example.com/export.pdf", expect.any(Object));
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    });
    expect(createdAnchors[createdAnchors.length - 1]?.download).toBe("lease-ledger-lease-1.pdf");
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it("adds a lease note from the ledger detail surface", async () => {
    render(
      <MemoryRouter initialEntries={["/leases/lease-1/ledger"]}>
        <Routes>
          <Route path="/leases/:leaseId/ledger" element={<LeaseLedgerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Harbour View · Unit 101");
    fireEvent.click(screen.getAllByRole("button", { name: "Add lease note" })[0]);
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Follow up on renewal" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => expect(mocks.createLeaseNote).toHaveBeenCalledWith("lease-1", "Follow up on renewal"));
  });
});
