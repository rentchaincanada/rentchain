import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuditCompliancePage from "./AuditCompliancePage";

const apiMocks = vi.hoisted(() => ({
  fetchAuditComplianceReadiness: vi.fn(),
  fetchOperatorReviewSessions: vi.fn(),
  openOperatorReviewSession: vi.fn(),
  addOperatorReviewNote: vi.fn(),
  closeOperatorReviewSession: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/auditComplianceApi", async () => {
  const actual = await vi.importActual<any>("@/api/auditComplianceApi");
  return {
    ...actual,
    fetchAuditComplianceReadiness: apiMocks.fetchAuditComplianceReadiness,
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

function readiness(overrides: Record<string, unknown> = {}) {
  return {
    readinessId: "audit_compliance:landlord_portfolio:landlord-1:portfolio",
    scope: "landlord_portfolio",
    status: "needs_attention",
    manualOnly: true,
    certificationIssued: false,
    externalFilingEnabled: false,
    automatedReportingEnabled: false,
    generatedAt: "2026-05-05T12:00:00.000Z",
    summary: {
      totalChecks: 3,
      passed: 1,
      needsAttention: 1,
      blocked: 1,
      unavailable: 0,
    },
    checks: [
      {
        checkKey: "property_identity_present",
        label: "Property identity present",
        status: "passed",
        severity: "critical",
        evidence: ["1 landlord-scoped property record is available."],
        missingEvidence: [],
        blockedReasons: [],
        manualReviewRequired: true,
      },
      {
        checkKey: "audit_event_coverage",
        label: "Audit event coverage",
        status: "needs_attention",
        severity: "medium",
        evidence: [],
        missingEvidence: ["No landlord-scoped audit or canonical event records were available."],
        blockedReasons: [],
        manualReviewRequired: true,
      },
      {
        checkKey: "sensitive_data_redacted",
        label: "Sensitive data redacted",
        status: "blocked",
        severity: "critical",
        evidence: [],
        missingEvidence: [],
        blockedReasons: ["Redaction metadata is required before readiness review."],
        manualReviewRequired: true,
      },
    ],
    redactions: [
      {
        fieldCategory: "tenant_contact_details",
        reason: "Tenant contact details are excluded.",
      },
    ],
    disclaimers: [
      "Readiness only. This is not legal certification.",
      "No external filing or automated reporting is performed.",
      "Manual review is required before sharing or relying on this package.",
    ],
    ...overrides,
  };
}

describe("AuditCompliancePage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    apiMocks.fetchAuditComplianceReadiness.mockResolvedValue(readiness());
    apiMocks.fetchOperatorReviewSessions.mockResolvedValue([]);
  });

  it("renders readiness summary, checks, redactions, and required safety copy", async () => {
    render(<AuditCompliancePage />);

    expect(await screen.findByRole("heading", { name: "Audit and compliance readiness" })).toBeInTheDocument();
    expect(screen.getAllByText(/Readiness only\. This is not legal certification\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No external filing or automated reporting is performed\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual review is required before sharing or relying on this package\./i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs Attention").length).toBeGreaterThan(0);
    expect(screen.getByText("Total checks")).toBeInTheDocument();
    expect(screen.getByText("Property identity present")).toBeInTheDocument();
    expect(screen.getByText("Audit event coverage")).toBeInTheDocument();
    expect(screen.getByText(/Missing evidence: No landlord-scoped audit or canonical event records/i)).toBeInTheDocument();
    expect(screen.getByText(/Blocked: Redaction metadata is required/i)).toBeInTheDocument();
    expect(screen.getByText("Tenant Contact Details")).toBeInTheDocument();
    expect(screen.getByText("Operator review session")).toBeInTheDocument();
    expect(screen.getByText(/Review sessions are audit logged/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /certify|submit|file|send|auto-report|approve compliance/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/approved compliant|legal compliance confirmed/i)).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("renders an empty redaction state safely", async () => {
    apiMocks.fetchAuditComplianceReadiness.mockResolvedValue(readiness({ redactions: [] }));

    render(<AuditCompliancePage />);

    expect(await screen.findByText("No redaction metadata is available yet.")).toBeInTheDocument();
  });
});
