import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantDetailPanel } from "./TenantDetailPanel";

const mocks = vi.hoisted(() => ({
  useTenantDetail: vi.fn(),
  fetchLedger: vi.fn(),
  fetchLeaseLedger: vi.fn(),
  fetchTenantFinancialActivity: vi.fn(),
  getTenantSignals: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../hooks/useTenantDetail", () => ({
  useTenantDetail: mocks.useTenantDetail,
}));

vi.mock("@/api/ledgerApi", () => ({
  fetchLedger: mocks.fetchLedger,
}));

vi.mock("@/api/leaseLedgerApi", () => ({
  fetchLeaseLedger: mocks.fetchLeaseLedger,
}));

vi.mock("@/api/tenantDetail", () => ({
  fetchTenantFinancialActivity: mocks.fetchTenantFinancialActivity,
  updateTenantMoveInReadiness: vi.fn(),
}));

vi.mock("@/api/tenantSignals", () => ({
  getTenantSignals: mocks.getTenantSignals,
}));

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => ({
    loading: false,
    capabilities: { ledger: true },
    canExportPdf: true,
    hasMoveInReadiness: true,
  }),
}));

vi.mock("@/context/UpgradeContext", () => ({
  useUpgrade: () => ({ openUpgrade: vi.fn() }),
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "landlord-1", role: "landlord", actorRole: "landlord", displayName: "Landlord" },
  }),
}));

vi.mock("./CredibilityInsightsCard", () => ({
  CredibilityInsightsCard: () => <div>Credibility insights</div>,
}));

vi.mock("./MoveInReadinessPanel", () => ({
  MoveInReadinessPanel: () => <div>Move-in readiness</div>,
}));

vi.mock("./TenantActivityPanel", () => ({
  TenantActivityPanel: () => <div>Tenant activity panel</div>,
}));

vi.mock("@/components/billing/FeatureGate", () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: () => <div>Locked feature</div>,
}));

vi.mock("../ledger/VerifyLedgerButton", () => ({
  VerifyLedgerButton: () => <button type="button">Verify ledger</button>,
}));

vi.mock("./RecordTenantEventModal", () => ({
  RecordTenantEventModal: () => null,
}));

vi.mock("./CreateNoticeModal", () => ({
  CreateNoticeModal: () => null,
}));

vi.mock("./LeasePackWizardModal", () => ({
  LeasePackWizardModal: () => null,
}));

describe("TenantDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTenantSignals.mockResolvedValue({ signals: null });
    mocks.fetchTenantFinancialActivity.mockResolvedValue([
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
    ]);
    mocks.fetchLedger.mockResolvedValue([]);
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
          method: null,
          reference: null,
          notes: "April rent",
          createdAt: 1,
          signedAmountCents: 185000,
          balanceCents: 185000,
        },
      ],
      totals: { chargesCents: 185000, paymentsCents: 0, balanceCents: 185000 },
      monthlyTotals: {},
    });
  });

  it("reads the current lease ledger source when a current lease id exists", async () => {
    mocks.useTenantDetail.mockReturnValue({
      loading: false,
      error: null,
      bundle: {
        tenant: {
          id: "tenant-1",
          fullName: "Taylor Tenant",
          currentLeaseId: "lease-1",
          propertyName: "Harbour View",
          unit: "101",
          lifecycle: {
            lifecycleState: "active",
            lifecycleLabel: "Active",
            lifecycleReason: "active_tenancy_or_lease_signal",
            confidence: "high",
            sourceFields: { leaseStatus: "active" },
            flags: {
              hasActiveLease: true,
              hasPendingLease: false,
              hasCompletedScreening: false,
              isArchived: false,
              isPastTenant: false,
              hasStateConflict: false,
            },
          },
        },
        currentLease: {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyName: "Harbour View",
          unit: "101",
          leaseStart: "2026-01-01",
          leaseEnd: "2026-12-31",
          monthlyRent: 1850,
          status: "active",
        },
        stateCoherence: {
          coherenceStatus: "review_required",
          coherenceLabel: "Needs review",
          coherenceReason: "lease_status_active_but_execution_incomplete",
          leaseExecutionState: "not_started",
          leaseOperationalState: "draft",
          occupancyState: "review_required",
          tenantOperationalState: "review_required",
          paymentReadinessState: "recorded_activity_present",
          sourceFields: {},
          flags: {
            leaseMarkedActiveBeforeExecution: true,
            activeLeaseOnVacantUnit: false,
            occupiedUnitWithoutActiveExecutedLease: true,
            tenantActiveWithoutExecutedOccupancy: true,
            paymentActivityWithoutProviderSetup: true,
            hasStateConflict: true,
            requiresReview: true,
          },
        },
        property: { id: "prop-1", name: "Harbour View", addressLine1: "123 Harbour St", city: "Halifax", province: "NS" },
        unit: { id: "unit-1", unitNumber: "101" },
        moveInReadiness: null,
      },
    });

    render(
      <MemoryRouter>
        <TenantDetailPanel tenantId="tenant-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText("Recent current lease ledger entries")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Needs review: Draft lease / Review Required occupancy")).toBeInTheDocument();
    expect(screen.getByText("Showing the most recent charges and payments from the current lease ledger.")).toBeInTheDocument();
    expect(screen.getByText("Use the current lease ledger to record charges and payments.")).toBeInTheDocument();
    expect(screen.getByText("Showing the latest 10 entries here. Open current lease ledger for the full history.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tenant activity is recorded separately and does not add charges or payments to the current lease ledger."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Record tenant activity" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Verify ledger" })).not.toBeInTheDocument();
    expect(screen.getByText(/Charge · rent/i)).toBeInTheDocument();
    expect(screen.getByText(/Balance .*1,850\.00/i)).toBeInTheDocument();
    expect(await screen.findByText("Financial activity")).toBeInTheDocument();
    expect(screen.getByText("Recorded Payments")).toBeInTheDocument();
    expect(screen.getByText("Recorded payment (e-transfer)")).toBeInTheDocument();
    expect(screen.getByText("Tenant activity panel")).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchLeaseLedger).toHaveBeenCalledWith("lease-1"));
    await waitFor(() => expect(mocks.fetchTenantFinancialActivity).toHaveBeenCalledWith("tenant-1"));
    expect(mocks.fetchLedger).not.toHaveBeenCalled();
  });

  it("falls back to the existing tenant-level ledger source when no current lease is linked", async () => {
    mocks.useTenantDetail.mockReturnValue({
      loading: false,
      error: null,
      bundle: {
        tenant: {
          id: "tenant-1",
          fullName: "Taylor Tenant",
          propertyName: "Harbour View",
          unit: "101",
        },
        currentLease: null,
        property: { id: "prop-1", name: "Harbour View", addressLine1: "123 Harbour St", city: "Halifax", province: "NS" },
        unit: { id: "unit-1", unitNumber: "101" },
        moveInReadiness: null,
      },
    });
    mocks.fetchLedger.mockResolvedValue([
      {
        id: "ledger-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        type: "PAYMENT_RECORDED",
        version: 1,
        ts: 1700000000000,
        seq: 1,
        prevHash: null,
        payload: { amountCents: 185000 },
        payloadHash: "payload-hash",
        hash: "hash",
        integrity: { status: "verified" },
      },
    ]);

    render(
      <MemoryRouter>
        <TenantDetailPanel tenantId="tenant-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No current lease is linked, so this view is showing the existing tenant-level ledger source\./i)).toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchLedger).toHaveBeenCalledWith({ tenantId: "tenant-1", limit: 50 }));
    await waitFor(() => expect(mocks.fetchTenantFinancialActivity).toHaveBeenCalledWith("tenant-1"));
  });

  it("formats current lease date-only values without shifting to the previous day", async () => {
    mocks.useTenantDetail.mockReturnValue({
      loading: false,
      error: null,
      bundle: {
        tenant: {
          id: "tenant-1",
          fullName: "Taylor Tenant",
          propertyName: "Harbour View",
          unit: "101",
        },
        currentLease: {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyName: "Harbour View",
          unit: "101",
          leaseStart: "2026-05-01",
          leaseEnd: "2027-04-30",
          monthlyRent: 1850,
          status: "active",
        },
        property: { id: "prop-1", name: "Harbour View", addressLine1: "123 Harbour St", city: "Halifax", province: "NS" },
        unit: { id: "unit-1", unitNumber: "101" },
        moveInReadiness: null,
      },
    });

    render(
      <MemoryRouter>
        <TenantDetailPanel tenantId="tenant-1" />
      </MemoryRouter>
    );

    expect(await screen.findByText("May 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("Apr 30, 2027")).toBeInTheDocument();
    expect(screen.queryByText("Apr 30, 2026")).not.toBeInTheDocument();
    expect(screen.queryByText("Apr 29, 2027")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchLeaseLedger).toHaveBeenCalledWith("lease-1"));
  });
});
