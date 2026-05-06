import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstitutionExportsPage from "./InstitutionExportsPage";

const apiMocks = vi.hoisted(() => ({
  fetchInstitutionExportPreview: vi.fn(),
  fetchOperatorReviewSessions: vi.fn(),
  openOperatorReviewSession: vi.fn(),
  addOperatorReviewNote: vi.fn(),
  closeOperatorReviewSession: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/institutionExportsApi", async () => {
  const actual = await vi.importActual<any>("@/api/institutionExportsApi");
  return {
    ...actual,
    fetchInstitutionExportPreview: apiMocks.fetchInstitutionExportPreview,
  };
});

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
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function previewPackage(overrides: Record<string, unknown> = {}) {
  return {
    packageId: "institution_export:lender_due_diligence:landlord-1",
    packageType: "lender_due_diligence",
    audience: "lender",
    status: "preview_ready",
    generatedAt: "2026-05-05T12:00:00.000Z",
    manualOnly: true,
    externalSubmissionEnabled: false,
    sections: [
      {
        sectionKey: "property_summary",
        label: "Property summary",
        status: "included",
        recordsCount: 2,
        blockedReasons: [],
      },
      {
        sectionKey: "audit_event_summary",
        label: "Audit event summary",
        status: "unavailable",
        recordsCount: 0,
        blockedReasons: ["No landlord-scoped audit events were available for this preview."],
      },
    ],
    blockedReasons: [],
    redactions: [
      {
        fieldCategory: "tenant_contact_details",
        reason: "Tenant email, phone, and private contact details are excluded from V1 previews.",
      },
      {
        fieldCategory: "payment_account_details",
        reason: "Bank account, card, processor payload, and provider account details are excluded.",
      },
    ],
    payloadPreview: {
      propertySummary: { propertyCount: 2, unitCount: 8 },
      leaseSummary: { activeLeaseCount: 6 },
      occupancySummary: { occupancyRate: 75 },
      decisionSummary: { total: 3, critical: 1 },
      maintenanceSummary: { total: 4 },
    },
    ...overrides,
  };
}

describe("InstitutionExportsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    apiMocks.fetchInstitutionExportPreview.mockResolvedValue(previewPackage());
    apiMocks.fetchOperatorReviewSessions.mockResolvedValue([]);
  });

  it("renders read-only preview status, sections, redactions, and safety copy", async () => {
    render(
      <MemoryRouter>
        <InstitutionExportsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Institution export preview" })).toBeInTheDocument();
    expect(screen.getByText(/Preview only\. No data is submitted externally\./i)).toBeInTheDocument();
    expect(screen.getByText(/Manual review required before sharing with any institution\./i)).toBeInTheDocument();
    expect(screen.getByText(/Sensitive tenant data may be excluded or redacted\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View readiness" })).toHaveAttribute("href", "/audit-compliance");
    expect(screen.getByText("Lender Due Diligence")).toBeInTheDocument();
    expect(screen.getByText("Preview Ready")).toBeInTheDocument();
    expect(screen.getByText("Property summary")).toBeInTheDocument();
    expect(screen.getByText("2 records")).toBeInTheDocument();
    expect(screen.getByText("Audit event summary")).toBeInTheDocument();
    expect(screen.getByText(/No landlord-scoped audit events/i)).toBeInTheDocument();
    expect(screen.getByText("Tenant Contact Details")).toBeInTheDocument();
    expect(screen.getByText("Payment Account Details")).toBeInTheDocument();
    expect(screen.getByText("Preview payload summary")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Operator review session")).toBeInTheDocument();
    expect(screen.getByText(/No automated approval or certification occurs/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit|send|upload|auto-report|schedule|file now/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/send to lender|send to institution/i)).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("reloads a deterministic preview when package type changes", async () => {
    apiMocks.fetchInstitutionExportPreview
      .mockResolvedValueOnce(previewPackage())
      .mockResolvedValueOnce(previewPackage({ packageType: "auditor_review", audience: "auditor" }));

    render(
      <MemoryRouter>
        <InstitutionExportsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Lender Due Diligence")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Package type"), { target: { value: "auditor_review" } });

    await waitFor(() => {
      expect(apiMocks.fetchInstitutionExportPreview).toHaveBeenLastCalledWith("auditor_review");
    });
    expect(await screen.findByText("Auditor Review")).toBeInTheDocument();
  });

  it("renders blocked readiness and blocked reasons", async () => {
    apiMocks.fetchInstitutionExportPreview.mockResolvedValue(
      previewPackage({
        status: "blocked",
        blockedReasons: ["At least one landlord-scoped property is required for institution export preview."],
      })
    );

    render(
      <MemoryRouter>
        <InstitutionExportsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText(/At least one landlord-scoped property is required/i)).toBeInTheDocument();
  });
});
