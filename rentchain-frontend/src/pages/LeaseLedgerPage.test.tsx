import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaseLedgerPage from "./LeaseLedgerPage";

const mocks = vi.hoisted(() => ({
  fetchLeaseLedger: vi.fn(),
  addLeaseCharge: vi.fn(),
  addLeasePayment: vi.fn(),
  leaseLedgerExportUrl: vi.fn(() => "https://example.com/export.csv"),
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
    mocks.fetchLeaseLedger.mockResolvedValue({
      ok: true,
      leaseId: "lease-1",
      entries: [
        {
          id: "entry-1",
          leaseId: "lease-1",
          entryType: "charge",
          category: "rent",
          amountCents: 185000,
          effectiveDate: "2026-04-01",
          createdAt: 1,
          signedAmountCents: 185000,
          balanceCents: 185000,
        },
      ],
      totals: { chargesCents: 185000, paymentsCents: 0, balanceCents: 185000 },
      monthlyTotals: {
        "2026-04": { chargesCents: 185000, paymentsCents: 0, netCents: 185000 },
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
