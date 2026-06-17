import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandlordActiveLeasesPage from "./LandlordActiveLeasesPage";

const mocks = vi.hoisted(() => ({
  getActiveLeasesForLandlord: vi.fn(),
  getArchivedLeasesForLandlord: vi.fn(),
  enableLeasePaymentRail: vi.fn(),
  getLeaseReconciliationCandidates: vi.fn(),
  downloadSignedLease: vi.fn(),
  refreshLeaseDocumentUrl: vi.fn(),
  convertUnitReferenceToLease: vi.fn(),
  archiveLeaseRecord: vi.fn(),
  restoreLeaseRecord: vi.fn(),
  printSummaryDocument: vi.fn(),
  useEntitlements: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getActiveLeasesForLandlord: mocks.getActiveLeasesForLandlord,
  getArchivedLeasesForLandlord: mocks.getArchivedLeasesForLandlord,
  enableLeasePaymentRail: mocks.enableLeasePaymentRail,
  getLeaseReconciliationCandidates: mocks.getLeaseReconciliationCandidates,
  downloadSignedLease: mocks.downloadSignedLease,
  refreshLeaseDocumentUrl: mocks.refreshLeaseDocumentUrl,
  convertUnitReferenceToLease: mocks.convertUnitReferenceToLease,
  archiveLeaseRecord: mocks.archiveLeaseRecord,
  restoreLeaseRecord: mocks.restoreLeaseRecord,
}));

vi.mock("@/utils/printSummary", () => ({
  printSummaryDocument: (...args: unknown[]) => mocks.printSummaryDocument(...args),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => mocks.useEntitlements(),
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ featureKey }: { featureKey: string }) => <div>Locked feature: {featureKey}</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-location">{`${location.pathname}${location.search}${location.hash}`}</div>;
}

describe("LandlordActiveLeasesPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.printSummaryDocument.mockReset();
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      hasCapability: (key: string) => key === "leases",
      requiredPlanFor: () => "starter",
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
          documentUrl: "https://example.com/lease.pdf",
          leaseExecution: {
            executionStatus: "fully_executed",
            executionLabel: "Lease fully executed",
            executionDescription: "The visible lease record indicates the current execution flow is complete.",
            requiredNextAction: "none",
            tenantSignatureStatus: "completed",
            landlordSignatureStatus: "completed",
            pdfStatus: "generated",
            completedAt: "2026-01-01T00:00:00.000Z",
          },
          paymentReadiness: {
            readinessStatus: "ready_to_configure",
            readinessLabel: "Rent terms ready for future setup",
            readinessDescription:
              "The current lease shows the core rent terms and tenancy linkage needed for a future payment setup workflow, without enabling any payment activity today.",
            requiredNextAction: "confirm_payment_setup_later",
            rentTerms: {
              rentAmountAvailable: true,
              dueDateAvailable: true,
              leaseDatesAvailable: true,
              tenantLinked: true,
              leaseExecuted: true,
            },
            paymentSetup: {
              processorConnected: false,
              moneyMovementEnabled: false,
              storedPaymentMethod: false,
            },
          },
          rentPaymentSummary: {
            paymentRail: {
              enabled: false,
              enabledAt: null,
              processor: null,
              blockedReason: null,
            },
            latestPayment: null,
            paymentExperience: {
              history: [],
              latestStatus: null,
              retryAvailable: false,
              receiptSummary: {
                available: false,
                label: "No payment summary available yet",
                amountCents: null,
                paidAt: null,
                leaseReference: null,
              },
            },
          },
          leaseLifecycleSummary: {
            lifecycleStatus: "expiring_soon",
            lifecycleLabel: "Expiring soon",
            lifecycleDescription: "This lease is approaching its notice timing and should be reviewed for renewal follow-through.",
            requiredNextAction: "prepare_renewal_notice",
            renewalOutcome: "not_started",
            daysUntilExpiry: 30,
            history: [{ type: "lease_started", label: "Lease started", occurredAt: "2026-01-01T00:00:00.000Z" }],
          },
          jurisdictionPolicies: [
            {
              jurisdiction: "NS",
              policyKey: "lease_renewal_review",
              status: "review",
              severity: "info",
              label: "Lease renewal review recommended",
              reason: "The lease end date is within the configured review window.",
              recommendation: "Review the lease and prepare next-step workflow guidance.",
              sourceRuleKey: "NS.lease_renewal_review",
              confidence: "medium",
              legalAdvice: false,
              disclaimer:
                "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
            },
            {
              jurisdiction: "NS",
              policyKey: "rent_increase_workflow_availability",
              status: "ok",
              severity: "info",
              label: "Rent increase workflow metadata available",
              reason: "This jurisdiction has rent increase workflow metadata configured for operational review.",
              recommendation: "Use the guided workflow as a review aid and verify current local requirements before sending notices.",
              sourceRuleKey: "NS.rent_increase_workflow",
              confidence: "medium",
              legalAdvice: false,
              disclaimer:
                "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
            },
            {
              jurisdiction: "NS",
              policyKey: "notice_workflow_readiness",
              status: "ok",
              severity: "info",
              label: "Notice workflow guidance available",
              reason: "Province-aware notice workflow metadata is available for landlord review.",
              recommendation: "Prepare notice workflow steps manually and verify local legal requirements before delivery.",
              sourceRuleKey: "NS.notice_workflow_readiness",
              confidence: "medium",
              legalAdvice: false,
              disclaimer:
                "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
            },
            {
              jurisdiction: "NS",
              policyKey: "deposit_workflow_review",
              status: "review",
              severity: "info",
              label: "Deposit workflow review available",
              reason: "This jurisdiction has deposit workflow metadata flagged for operational review.",
              recommendation: "Review deposit handling as part of the lease workflow without treating this as a compliance determination.",
              sourceRuleKey: "NS.deposit_workflow_review",
              confidence: "medium",
              legalAdvice: false,
              disclaimer:
                "RentChain provides operational workflow guidance only. It does not provide legal advice, create legal conclusions, or replace review of current provincial forms and rules.",
            },
          ],
        },
      ],
    });
    mocks.getArchivedLeasesForLandlord.mockResolvedValue({ leases: [] });
    mocks.getLeaseReconciliationCandidates.mockResolvedValue({
      candidates: [
        {
          id: "unit-9",
          unitId: "unit-9",
          propertyId: "prop-9",
          propertyName: "Dockside",
          unitNumber: "9",
          occupantName: "Recovered Tenant",
          monthlyRent: 2100,
          leaseEndDate: "2026-12-31",
          canConvert: true,
          blockingReasons: [],
          leaseDocument: {
            fileName: "lease.pdf",
            url: "https://example.com/unit-lease.pdf",
          },
        },
      ],
    });
    mocks.refreshLeaseDocumentUrl.mockResolvedValue({
      documentUrl: "https://example.com/lease-refreshed.pdf",
      refreshMode: "signed_url",
      expiresInSeconds: 1800,
    });
    mocks.downloadSignedLease.mockReset();
    mocks.downloadSignedLease.mockResolvedValue({
      documentUrl: "https://example.com/signed-lease-fresh.pdf",
      signingStatus: "signed",
      signedAt: "2026-01-02T00:00:00.000Z",
    });
    mocks.convertUnitReferenceToLease.mockResolvedValue({
      ok: true,
      lease: { id: "lease-9" },
      tenant: { id: "tenant-9", fullName: "Recovered Tenant" },
    });
    mocks.enableLeasePaymentRail.mockResolvedValue({
      leaseId: "lease-1",
      paymentRail: {
        enabled: true,
        enabledAt: "2026-04-27T10:00:00.000Z",
        processor: "stripe",
        eligibility: "eligible",
        blockedReason: null,
      },
    });
    mocks.archiveLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1" } });
    mocks.restoreLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-2" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "open").mockReturnValue(null);
  });

  it("shows a locked lease state for free-tier users without calling paid lease APIs", async () => {
    mocks.useEntitlements.mockReturnValue({
      loading: false,
      hasCapability: () => false,
      requiredPlanFor: () => "starter",
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Locked feature: leases")).toBeInTheDocument();
    expect(mocks.getActiveLeasesForLandlord).not.toHaveBeenCalled();
    expect(mocks.getLeaseReconciliationCandidates).not.toHaveBeenCalled();
    expect(screen.queryByText(/Upgrade required/i)).not.toBeInTheDocument();
  });

  it("renders active leases with ledger, email, save, and archive actions", async () => {
    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Harbour View")).length).toBeGreaterThan(0);
    expect(document.querySelector(".rc-leases-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeInTheDocument();
    expect(screen.getAllByText("Lease fully executed").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Needs review: Draft lease · Review needed occupancy/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Lease execution review recommended")).not.toBeInTheDocument();
    expect(screen.getAllByText("Expiring soon").length).toBeGreaterThan(0);
    expect(screen.getByText(/Prepare renewal notice/i)).toBeInTheDocument();
    expect(screen.getByText("NS Workflow Guidance:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renewal Review" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/renewal"
    );
    expect(screen.getByRole("link", { name: "Rent Increase Workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/rent-increase"
    );
    expect(screen.getByRole("link", { name: "Notice Workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/notice"
    );
    expect(screen.getByRole("link", { name: "Deposit Workflow" })).toHaveAttribute(
      "href",
      "/leases/lease-1/workflows/deposit"
    );
    expect(screen.getByText("Verify local requirements.")).toBeInTheDocument();
    expect(screen.queryByText("Lease renewal review recommended")).not.toBeInTheDocument();
    expect(screen.queryByText("Rent increase workflow metadata available")).not.toBeInTheDocument();
    expect(screen.queryByText("Notice workflow guidance available")).not.toBeInTheDocument();
    expect(screen.queryByText("Deposit workflow review available")).not.toBeInTheDocument();
    expect(screen.queryByText(/Prepare notice workflow steps manually/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Rent terms ready for future setup/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Enable rent collection/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View lease" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:jane%40example.com")
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View lease" }));
    await waitFor(() => expect(mocks.refreshLeaseDocumentUrl).toHaveBeenCalledWith("lease-1"));
    expect(window.open).toHaveBeenCalledWith("https://example.com/lease-refreshed.pdf", "_blank", "noreferrer");
    fireEvent.click(screen.getByRole("button", { name: /Enable rent collection/i }));
    await waitFor(() => expect(mocks.enableLeasePaymentRail).toHaveBeenCalledWith("lease-1"));
    fireEvent.click(screen.getByRole("button", { name: "Archive lease" }));
    await waitFor(() => expect(mocks.archiveLeaseRecord).toHaveBeenCalledWith("lease-1"));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(mocks.printSummaryDocument).toHaveBeenCalledWith("summary");
  });

  it("navigates compact workflow buttons to distinct summary section URLs", async () => {
    render(
      <MemoryRouter>
        <LocationProbe />
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    await screen.findByText("NS Workflow Guidance:");

    fireEvent.click(screen.getByRole("link", { name: "Rent Increase Workflow" }));
    expect(screen.getByTestId("current-location")).toHaveTextContent("/leases/lease-1/workflows/rent-increase");

    fireEvent.click(screen.getByRole("link", { name: "Deposit Workflow" }));
    expect(screen.getByTestId("current-location")).toHaveTextContent("/leases/lease-1/workflows/deposit");

    fireEvent.click(screen.getByRole("link", { name: "Notice Workflow" }));
    expect(screen.getByTestId("current-location")).toHaveTextContent("/leases/lease-1/workflows/notice");

    fireEvent.click(screen.getByRole("link", { name: "Renewal Review" }));
    expect(screen.getByTestId("current-location")).toHaveTextContent("/leases/lease-1/workflows/renewal");
  });

  it("does not open stale GCS or app-domain lease document fallbacks when refresh fails", async () => {
    mocks.refreshLeaseDocumentUrl.mockReset();
    mocks.refreshLeaseDocumentUrl.mockRejectedValueOnce(new Error("refresh failed"));
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-stale",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitNumber: "6",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Chip Milo",
          tenantEmail: "hello+cob6tenant@rentchain.ai",
          documentUrl:
            "https://storage.googleapis.com/lease-documents/leases/PXbRIbJdZpV2eBjzNmLaISgDa852/nkzRYxdZ49p0IGdXD3mS/schedule-a-v1.pdf?X-Goog-Expires=1",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    vi.mocked(window.open).mockClear();
    expect(await screen.findByRole("button", { name: "Primary lease document unavailable" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Lease summary" })).toHaveAttribute("href", "/leases/lease-stale/summary");
    fireEvent.click(screen.getByRole("button", { name: "View Schedule A" }));
    await waitFor(() => expect(mocks.refreshLeaseDocumentUrl).toHaveBeenCalledWith("lease-stale", { document: "schedule-a" }));
    expect(window.open).not.toHaveBeenCalled();
    expect(await screen.findByText("refresh failed")).toBeInTheDocument();
  });

  it("opens a fresh signed document when a signed lease primary document refresh is unavailable", async () => {
    mocks.refreshLeaseDocumentUrl.mockReset();
    mocks.refreshLeaseDocumentUrl.mockRejectedValueOnce(new Error("lease_document_not_found"));
    mocks.downloadSignedLease.mockResolvedValueOnce({
      documentUrl: "https://example.com/fresh-signed-download.pdf",
      signingStatus: "signed",
      signedAt: "2026-01-02T00:00:00.000Z",
    });
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-signed",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitNumber: "6",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Chip Milo",
          tenantEmail: "hello+cob6tenant@rentchain.ai",
          documentUrl: "https://storage.googleapis.com/signed-lease-documents/stale.pdf?X-Goog-Signature=expired",
          signingStatus: "signed",
          leaseExecution: {
            executionStatus: "fully_executed",
            executionLabel: "Lease fully executed",
            executionDescription: "The signing workflow is complete.",
            requiredNextAction: "none",
            tenantSignatureStatus: "completed",
            landlordSignatureStatus: "completed",
            pdfStatus: "generated",
            completedAt: "2026-01-02T00:00:00.000Z",
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    vi.mocked(window.open).mockClear();
    fireEvent.click(await screen.findByRole("button", { name: "View lease" }));

    await waitFor(() => expect(mocks.refreshLeaseDocumentUrl).toHaveBeenCalledWith("lease-signed"));
    await waitFor(() => expect(mocks.downloadSignedLease).toHaveBeenCalledWith("lease-signed"));
    expect(window.open).toHaveBeenCalledWith("https://example.com/fresh-signed-download.pdf", "_blank", "noreferrer");
    expect(window.open).not.toHaveBeenCalledWith(
      expect.stringContaining("X-Goog-Signature=expired"),
      expect.anything(),
      expect.anything()
    );
  });

  it("does not expose View lease for generated draft primary-document previews", async () => {
    mocks.refreshLeaseDocumentUrl.mockReset();
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-draft-generated",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitNumber: "6",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Chip Milo",
          tenantEmail: "hello+cob6tenant@rentchain.ai",
          documentUrl:
            "https://storage.googleapis.com/rentchain-lease-documents/lease-documents/hash/lease-draft-generated.pdf?X-Goog-Expires=1800",
          signingStatus: "not_started",
          leaseExecution: {
            executionStatus: "draft",
            executionLabel: "Draft lease",
            executionDescription: "The generated lease is available for preview before signing.",
            requiredNextAction: "tenant_signature",
            tenantSignatureStatus: "needed",
            landlordSignatureStatus: "not_required",
            pdfStatus: "generated",
            completedAt: null,
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: "Use Preview Lease Document" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "View lease" })).not.toBeInTheDocument();
    expect(mocks.refreshLeaseDocumentUrl).not.toHaveBeenCalled();
  });

  it("shows Schedule A as a separate action without replacing the lease summary action", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-schedule",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitNumber: "6",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Chip Milo",
          tenantEmail: "hello+cob6tenant@rentchain.ai",
          documentUrl: null,
          scheduleAUrl: "https://example.com/schedule-a.pdf",
        },
      ],
    });
    mocks.refreshLeaseDocumentUrl.mockResolvedValueOnce({
      documentUrl: "https://example.com/schedule-a-refreshed.pdf",
      refreshMode: "signed_url",
      expiresInSeconds: 1800,
      documentKind: "schedule-a",
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: "Primary lease document unavailable" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Lease summary" })).toHaveAttribute(
      "href",
      "/leases/lease-schedule/summary"
    );
    fireEvent.click(screen.getByRole("button", { name: "View Schedule A" }));
    await waitFor(() =>
      expect(mocks.refreshLeaseDocumentUrl).toHaveBeenCalledWith("lease-schedule", { document: "schedule-a" })
    );
    expect(window.open).toHaveBeenCalledWith("https://example.com/schedule-a-refreshed.pdf", "_blank", "noreferrer");
  });

  it("does not open a Schedule A URL returned by the primary lease refresh path", async () => {
    mocks.refreshLeaseDocumentUrl.mockReset();
    mocks.refreshLeaseDocumentUrl.mockResolvedValueOnce({
      documentUrl: "https://storage.googleapis.com/lease-documents/leases/landlord/draft/schedule-a-v1.pdf",
      refreshMode: "signed_url",
      expiresInSeconds: 1800,
      documentKind: "lease",
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    vi.mocked(window.open).mockClear();
    fireEvent.click(await screen.findByRole("button", { name: "View lease" }));
    await waitFor(() => expect(mocks.refreshLeaseDocumentUrl).toHaveBeenCalledWith("lease-1"));
    expect(window.open).not.toHaveBeenCalled();
  });

  it("renders date-only lease dates without shifting them backward across timezones", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-may",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-05-01",
          endDate: "2026-06-01",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
        },
        {
          id: "lease-iso",
          propertyId: "prop-2",
          propertyName: "Dockside",
          unitNumber: "202",
          monthlyRent: 1950,
          startDate: "2026-05-01T12:00:00.000Z",
          endDate: "2026-06-01T12:00:00.000Z",
          status: "active",
          tenantName: "Mark Harbor",
          tenantEmail: "mark@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByText("May 1, 2026")).not.toHaveLength(0);
    expect(screen.getAllByText(/June 1, 2026/)).not.toHaveLength(0);
    expect(screen.queryByText("April 30, 2026")).not.toBeInTheDocument();
    expect(screen.queryByText("May 31, 2026")).not.toBeInTheDocument();
  });

  it("shows landlord-safe payment visibility without retry or receipt actions", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
          rentPaymentSummary: {
            paymentRail: {
              enabled: true,
              enabledAt: "2026-04-27T10:00:00.000Z",
              processor: "stripe",
              blockedReason: null,
            },
            latestPayment: {
              id: "rp-2",
              amountCents: 185000,
              currency: "cad",
              status: "payment_pending",
              createdAt: "2026-04-20T00:00:00.000Z",
              updatedAt: "2026-04-21T00:00:00.000Z",
              paidAt: null,
            },
            paymentExperience: {
              history: [
                {
                  id: "rp-2",
                  amountCents: 185000,
                  currency: "cad",
                  status: "payment_pending",
                  createdAt: "2026-04-20T00:00:00.000Z",
                  updatedAt: "2026-04-21T00:00:00.000Z",
                  paidAt: null,
                },
                {
                  id: "rp-1",
                  amountCents: 185000,
                  currency: "cad",
                  status: "failed",
                  createdAt: "2026-03-20T00:00:00.000Z",
                  updatedAt: "2026-03-21T00:00:00.000Z",
                  paidAt: null,
                },
              ],
              latestStatus: "pending",
              retryAvailable: false,
              receiptSummary: {
                available: false,
                label: "No payment summary available yet",
                amountCents: null,
                paidAt: null,
                leaseReference: null,
              },
            },
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Rent collection enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/^Payment confirmation pending$/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting processor confirmation\./i)).toBeInTheDocument();
    expect(screen.getByText(/Payment pending → Payment failed/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Print \/ Save payment summary/i })).not.toBeInTheDocument();
  });

  it("shows review-safe coherence flags without changing lease actions", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-review",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
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
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Needs review: Draft lease · Review needed occupancy/i)).toBeInTheDocument();
    expect(screen.getByText("Review needed")).toBeInTheDocument();
    expect(screen.getByText("Recorded ledger payment activity present")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/leases/lease-review/ledger");
  });

  it("maps landlord payment blockers without exposing raw codes", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
          rentPaymentSummary: {
            paymentRail: {
              enabled: false,
              enabledAt: null,
              processor: null,
              blockedReason: "payment_already_pending",
            },
            latestPayment: null,
            paymentExperience: {
              history: [],
              latestStatus: null,
              retryAvailable: false,
              receiptSummary: {
                available: false,
                label: "No payment summary available yet",
                amountCents: null,
                paidAt: null,
                leaseReference: null,
              },
            },
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Rent collection not enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/^No payment started$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/A checkout is already open for this lease\. Finish the existing checkout or wait for its status to update\./i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/payment already pending/i)).not.toBeInTheDocument();
  });

  it("does not render a lease document action when no document URL is available", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Harbour View")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Primary lease document unavailable" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Lease summary" })).toHaveAttribute("href", "/leases/lease-1/summary");
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows reconciliation candidates and converts a reference into a lease", async () => {
    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Occupied units missing lease records/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View reference" })).not.toBeInTheDocument();
    expect(screen.getByText("Lease document link expired and needs regeneration.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Convert unit 9 to lease" })[0]);
    fireEvent.change(screen.getByLabelText("Tenant phone (optional)"), { target: { value: "(902) 555-1111 ext 9" } });
    fireEvent.change(screen.getByLabelText("Co-applicant email (optional)"), { target: { value: "coapplicant@example.com" } });
    fireEvent.change(screen.getByLabelText("Co-applicant phone (optional)"), { target: { value: "902-555-3333" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-04-01" } });
    fireEvent.change(screen.getByLabelText("Monthly rent"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create lease" }));

    await waitFor(() =>
      expect(mocks.convertUnitReferenceToLease).toHaveBeenCalledWith(
        "unit-9",
        expect.objectContaining({
          tenantPhone: "90255511119",
          coApplicantEmail: "coapplicant@example.com",
          coApplicantPhone: "9025553333",
          startDate: "2026-04-01",
          monthlyRent: 2100,
        })
      )
    );
  });

  it("shows a recovery action when conversion is blocked by missing info", async () => {
    mocks.getLeaseReconciliationCandidates.mockResolvedValue({
      candidates: [
        {
          id: "unit-3",
          unitId: "unit-3",
          propertyId: "prop-3",
          propertyName: "Dockside",
          unitNumber: "3",
          occupantName: null,
          monthlyRent: 0,
          leaseEndDate: null,
          canConvert: false,
          blockingReasons: ["occupant_name_required", "rent_required"],
          leaseDocument: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Complete tenant info")).toHaveAttribute(
      "href",
      "/properties?propertyId=prop-3&unitId=unit-3"
    );
    expect(screen.queryByRole("button", { name: "Convert unit 3 to lease" })).not.toBeInTheDocument();
    expect(screen.getByText("Missing: Occupant name required, Monthly rent required")).toBeInTheDocument();
  });

  it("loads archived leases when archive view is selected", async () => {
    mocks.getArchivedLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-2",
          propertyId: "prop-2",
          propertyName: "Archived Place",
          unitNumber: "2B",
          monthlyRent: 1200,
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          status: "ended",
          archivedAt: "2026-04-01T00:00:00.000Z",
          tenantName: "Past Tenant",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/leases?view=archived"]}>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Archived Place")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.restoreLeaseRecord).toHaveBeenCalledWith("lease-2"));
  });

  it("filters the current lease list by tenant, unit, and property with a no-match state", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
        },
        {
          id: "lease-2",
          propertyId: "prop-2",
          propertyName: "Dockside Flats",
          unitNumber: "9B",
          monthlyRent: 2100,
          startDate: "2026-02-01",
          endDate: "2027-01-31",
          status: "active",
          tenantName: "Mark Harbor",
          tenantEmail: "mark@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Jane Tenant")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);

    const search = screen.getByLabelText("Search leases");

    fireEvent.change(search, { target: { value: "jane" } });
    expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mark Harbor")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: " 9b " } });
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);
    expect(screen.queryByText("Jane Tenant")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "dockside" } });
    expect(screen.getAllByText("Dockside Flats").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Harbour View")).toHaveLength(0);

    fireEvent.change(search, { target: { value: "no-match" } });
    expect(screen.getByText("No leases match your search.")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);
  });

  it("fails closed by hiding targeted synthetic cleanup leases from the landlord list", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "test_lease_quit_01",
          propertyId: "prop-1",
          propertyName: "Property_test",
          unitNumber: "UNIT_B",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "test2",
          tenantEmail: "hello+tenanttest2@rentchain.ai",
        },
        {
          id: "lease-visible",
          propertyId: "prop-2",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Harbour View")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Property_test")).toHaveLength(0);
    expect(screen.queryAllByText("test2")).toHaveLength(0);
  });

  it("renders mobile lease cards with the existing lease action surface on narrow screens", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByTestId("lease-mobile-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View lease" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ledger" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive lease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enable rent collection/i })).toBeInTheDocument();
  });
});
