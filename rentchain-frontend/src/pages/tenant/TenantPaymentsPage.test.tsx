import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantPaymentsPage from "./TenantPaymentsPage";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantPayments: vi.fn(),
  getTenantPaymentsSummary: vi.fn(),
  getTenantRentCharges: vi.fn(),
  confirmTenantRentCharge: vi.fn(),
}));

const tenantWorkspaceApi = vi.hoisted(() => ({
  getTenantWorkspace: vi.fn(),
}));

const tenantLayout = vi.hoisted(() => ({
  context: {
    lease: {
      propertyName: "123 Main St",
      unitNumber: "2",
    },
  } as { lease: { propertyName: string; unitNumber: string } | null } | null,
}));

vi.mock("../../api/tenantPortalApi", () => tenantPortalApi);
vi.mock("../../api/tenantPortal", () => tenantWorkspaceApi);

vi.mock("./TenantLayout.clean", () => ({
  useTenantOutletContext: () => tenantLayout.context,
}));

describe("TenantPaymentsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantLayout.context = {
      lease: {
        propertyName: "123 Main St",
        unitNumber: "2",
      },
    };
    tenantWorkspaceApi.getTenantWorkspace.mockResolvedValue(null);
  });

  it("renders tenant payment history when auxiliary payment surfaces are unavailable", async () => {
    const notFound = Object.assign(new Error("Request failed (404)"), { status: 404 });
    tenantPortalApi.getTenantPayments.mockResolvedValue([
      {
        id: "internal-payment-id-1",
        amount: 1200,
        dueDate: "2026-05-01",
        paidAt: "2026-05-02",
        method: "e-transfer",
        status: "paid",
        notes: "May rent",
      },
    ]);
    tenantPortalApi.getTenantPaymentsSummary.mockRejectedValue(notFound);
    tenantPortalApi.getTenantRentCharges.mockRejectedValue(notFound);

    render(<TenantPaymentsPage />);

    expect(await screen.findByText(/Rent payments/i)).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("e-transfer")).toBeInTheDocument();
    expect(screen.getByText("May rent")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed \(404\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No rent charges issued yet/i)).toBeInTheDocument();
    expect(screen.queryByText("internal-payment-id-1")).not.toBeInTheDocument();
  });

  it("renders a safe empty state when tenant layout context is not ready", async () => {
    tenantLayout.context = null;
    tenantPortalApi.getTenantPayments.mockResolvedValue([]);
    tenantPortalApi.getTenantPaymentsSummary.mockResolvedValue(null);
    tenantPortalApi.getTenantRentCharges.mockResolvedValue([]);

    render(<TenantPaymentsPage />);

    expect(await screen.findByText(/Rent payments/i)).toBeInTheDocument();
    expect(screen.getByText(/Your lease/i)).toBeInTheDocument();
    expect(await screen.findByText(/No active lease found/i)).toBeInTheDocument();
  });

  it("shows payment setup guidance when the workspace has an active lease but checkout is unavailable", async () => {
    tenantLayout.context = null;
    tenantPortalApi.getTenantPayments.mockResolvedValue([]);
    tenantPortalApi.getTenantPaymentsSummary.mockResolvedValue(null);
    tenantPortalApi.getTenantRentCharges.mockResolvedValue([]);
    tenantWorkspaceApi.getTenantWorkspace.mockResolvedValue({
      context: {
        authority: "active_tenant",
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        applicationId: "app-1",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        unitId: "raw-unit-id-123456789",
        invitedEmail: "tenant@example.com",
      },
      property: {
        propertyId: "prop-1",
        rc_prop_id: "rc-prop-1",
        street1: "Kentville Suites",
        street2: null,
        city: "Kentville",
        province: "NS",
        postalCode: "B4N 1A1",
        features: [],
      },
      unit: { unitId: "raw-unit-id-123456789", label: "105" },
      application: null,
      maintenance: [],
      lease: {
        leaseId: "lease-1",
        status: "active",
        startDate: "2025-09-01",
        endDate: "2026-08-31",
        monthlyRent: 1500,
        documentUrl: null,
        paymentReadiness: {
          readinessStatus: "not_ready",
          readinessLabel: "Review rent terms",
          readinessDescription: "Lease payment setup details still need review before checkout can start.",
          requiredNextAction: "review_rent_terms",
          rentTerms: {
            rentAmountAvailable: true,
            dueDateAvailable: false,
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
              label: "",
              amountCents: null,
              paidAt: null,
              leaseReference: null,
            },
          },
        },
      },
    });

    render(<TenantPaymentsPage />);

    expect(await screen.findByText(/Kentville Suites · Unit 105/i)).toBeInTheDocument();
    expect(screen.getByText(/Rent collection not enabled yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Lease payment setup details still need review before checkout can start/i)).toBeInTheDocument();
    expect(screen.getByText(/Online rent payments are not available yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/No active lease found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw-unit-id-123456789/i)).not.toBeInTheDocument();
  });
});
