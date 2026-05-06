import { describe, expect, it } from "vitest";
import { deriveEvidencePack } from "../deriveEvidencePack";

const decision: any = {
  id: "decision-1",
  title: "Review missing payment",
  description: "Expected rent payment is missing.",
  severity: "critical",
  status: "open",
  type: "billing",
  source: "lease_ledger",
  destination: "/leases/lease-1/ledger",
  workflow: {
    queue: "delinquency_review",
    workflowState: "escalated",
    ownershipType: "landlord",
    reviewPriority: "critical",
    escalationLevel: "critical",
    manualOnly: true,
  },
  createdAt: "2026-05-05T12:00:00.000Z",
  updatedAt: "2026-05-05T12:00:00.000Z",
};

const exportPackage: any = {
  packageId: "institution_export:lender_due_diligence:landlord-1",
  packageType: "lender_due_diligence",
  audience: "lender",
  status: "preview_ready",
  generatedAt: "2026-05-05T12:00:00.000Z",
  manualOnly: true,
  externalSubmissionEnabled: false,
  sections: [{ sectionKey: "decision_summary", label: "Decision summary", status: "included", recordsCount: 1, blockedReasons: [] }],
  blockedReasons: [],
  redactions: [{ fieldCategory: "payment_account_details", reason: "Payment account details are excluded." }],
  payloadPreview: {},
};

const readiness: any = {
  readinessId: "audit_compliance:landlord_portfolio:landlord-1:portfolio",
  scope: "landlord_portfolio",
  status: "needs_attention",
  manualOnly: true,
  certificationIssued: false,
  externalFilingEnabled: false,
  automatedReportingEnabled: false,
  generatedAt: "2026-05-05T12:00:00.000Z",
  summary: { totalChecks: 1, passed: 1, needsAttention: 0, blocked: 0, unavailable: 0 },
  checks: [{ checkKey: "sensitive_data_redacted", label: "Sensitive data redacted", status: "passed", severity: "critical", evidence: ["Redactions present."], missingEvidence: [], blockedReasons: [], manualReviewRequired: true }],
  redactions: [{ fieldCategory: "screening_payloads", reason: "Screening payloads are excluded." }],
  disclaimers: [],
};

describe("deriveEvidencePack", () => {
  it("derives deterministic read-only evidence packs with redactions", () => {
    const pack = deriveEvidencePack({
      scope: "decision",
      scopeId: "decision-1",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      decisions: [decision],
      operatorReviewSessions: [{
        reviewSessionId: "review-1",
        landlordId: "landlord-1",
        scope: "decision",
        scopeId: "decision-1",
        status: "completed",
        openedAt: "2026-05-05T12:01:00.000Z",
        closedAt: "2026-05-05T12:02:00.000Z",
        openedBy: { userId: "landlord-1", role: "landlord" },
        outcome: { result: "reviewed", summary: "Reviewed", recordedAt: "2026-05-05T12:02:00.000Z", recordedBy: { userId: "landlord-1", role: "landlord" } },
        notes: [],
        linkedEvidence: [],
        manualOnly: true,
        systemGenerated: false,
        updatedAt: "2026-05-05T12:02:00.000Z",
      } as any],
      institutionExportPackage: exportPackage,
      auditComplianceReadiness: readiness,
      canonicalEvents: [{ id: "event-1", type: "operator_review_session_closed", summary: "Review closed", resource: { id: "decision-1" }, occurredAt: "2026-05-05T12:02:00.000Z" }],
      leases: [{ id: "lease-1", leaseId: "lease-1", propertyId: "prop-1", unitId: "unit-1" }],
      properties: [{ id: "prop-1", name: "Main property" }],
      maintenanceRequests: [],
    });

    expect(pack).toEqual(expect.objectContaining({
      evidencePackId: "evidence_pack:decision:landlord-1:decision-1",
      manualReviewRequired: true,
      externalSharingEnabled: false,
      certificationIssued: false,
    }));
    expect(pack.sections.map((section) => section.sectionKey)).toEqual(expect.arrayContaining([
      "decision_lineage",
      "workflow_routing",
      "operator_review_sessions",
      "audit_events",
      "redaction_summary",
    ]));
    expect(pack.redactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldCategory: "payment_account_details" }),
      expect.objectContaining({ fieldCategory: "screening_payloads" }),
    ]));
    expect(pack.summary.redactedItems).toBeGreaterThan(0);
    expect(JSON.stringify(pack)).not.toMatch(/accountNumber|creditReport|bureauPayload|privateDocument/i);
  });

  it("blocks readiness when redaction metadata is missing", () => {
    const pack = deriveEvidencePack({
      scope: "decision",
      scopeId: "decision-1",
      landlordId: "landlord-1",
      decisions: [decision],
      institutionExportPackage: { ...exportPackage, redactions: [] },
      auditComplianceReadiness: { ...readiness, redactions: [] },
    });

    expect(pack.status).toBe("blocked");
    expect(pack.blockedReasons).toEqual(expect.arrayContaining([
      "Redaction metadata is required before evidence can be review-ready.",
    ]));
  });

  it("marks missing scope context unavailable", () => {
    const pack = deriveEvidencePack({
      scope: "decision",
      scopeId: "",
      landlordId: "landlord-1",
      decisions: [],
    });

    expect(pack.status).toBe("unavailable");
    expect(pack.manualReviewRequired).toBe(true);
  });
});
