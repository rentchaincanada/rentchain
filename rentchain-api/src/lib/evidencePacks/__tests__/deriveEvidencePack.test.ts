import { describe, expect, it } from "vitest";
import { deriveEvidencePack } from "../deriveEvidencePack";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";

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
      projectionVersion: "evidence_projection_profile_v1",
      sensitivityClass: "restricted",
      manualReviewRequired: true,
      externalSharingEnabled: false,
      certificationIssued: false,
    }));
    expect(pack.projectionProfile).toEqual(
      expect.objectContaining({
        profileName: "landlord_evidence_review",
        profileVersion: "evidence_projection_profile_v1",
        audience: "landlord_operational_review",
        scopeType: "decision",
        sensitivityClass: "restricted",
        internalReferencePolicy:
          "Internal IDs may appear only as scoped source references, never as primary display labels.",
        sourceLineagePolicy:
          "Each included evidence item declares a source collection and source ID when available.",
      }),
    );
    expect(pack.projectionProfile.allowedFieldGroups).toEqual(
      expect.arrayContaining([
        "operational_labels",
        "status_summaries",
        "scoped_source_references",
        "redaction_categories",
      ]),
    );
    expect(pack.projectionProfile.excludedFieldGroups).toEqual(
      expect.arrayContaining([
        "raw_provider_payloads",
        "raw_csv_values",
        "payment_account_details",
        "private_message_bodies",
        "debug_payloads",
      ]),
    );
    expect(pack.sourceCollections).toEqual(
      expect.arrayContaining([
        "auditComplianceReadiness",
        "canonicalEvents",
        "decisionItems",
        "institutionExportPackages",
        "leases",
        "operatorReviewSessions",
        "properties",
      ]),
    );
    expect(pack.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceCollection: "decisionItems",
          sourceId: "decision-1",
          itemType: "decision",
          itemLabel: "Review missing payment",
        }),
        expect.objectContaining({
          sourceCollection: "canonicalEvents",
          sourceId: "event-1",
          itemType: "canonical_event",
        }),
      ]),
    );
    expect(pack.redactionSummary).toEqual(
      expect.objectContaining({
        redactionPolicy:
          "Exclude raw/provider/payment credential/debug/private-message fields; include redaction categories only.",
        redactionCount: 2,
        redactedFieldGroups: ["payment_account_details", "screening_payloads"],
      }),
    );
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

  it("derives deterministic source lineage without using internal IDs as primary labels", () => {
    const first = deriveEvidencePack({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      decisions: [decision],
      canonicalEvents: [
        {
          id: "event-lease-1",
          type: "lease_context_reviewed",
          summary: "Lease context reviewed.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          occurredAt: "2026-05-05T12:03:00.000Z",
        },
      ],
      leases: [{ id: "lease-1", propertyName: "North Towers", unitNumber: "101", tenantName: "John Smith" }],
      properties: [{ id: "prop-1", name: "North Towers" }],
      institutionExportPackage: exportPackage,
      auditComplianceReadiness: readiness,
    });
    const second = deriveEvidencePack({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:00:00.000Z",
      decisions: [decision],
      canonicalEvents: [
        {
          id: "event-lease-1",
          type: "lease_context_reviewed",
          summary: "Lease context reviewed.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          occurredAt: "2026-05-05T12:03:00.000Z",
        },
      ],
      leases: [{ id: "lease-1", propertyName: "North Towers", unitNumber: "101", tenantName: "John Smith" }],
      properties: [{ id: "prop-1", name: "North Towers" }],
      institutionExportPackage: exportPackage,
      auditComplianceReadiness: readiness,
    });

    expect(first.sourceRefs).toEqual(second.sourceRefs);
    expect(first.sourceRefs.map((ref) => `${ref.sourceCollection}:${ref.sourceId}:${ref.itemType}`)).toEqual(
      [...first.sourceRefs.map((ref) => `${ref.sourceCollection}:${ref.sourceId}:${ref.itemType}`)].sort(),
    );
    expect(first.sections.find((section) => section.sectionKey === "lease_context")?.items[0]?.label).toBe(
      "North Towers · Unit 101 · John Smith",
    );
    expect(first.sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain(
      "Lease lease-1",
    );
    expect(first.projectionProfile.allowedSourceCollections).toEqual(first.sourceCollections);
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

  it("uses operational evidence labels instead of raw lease and decision identifiers", () => {
    const pack = deriveEvidencePack({
      scope: "lease",
      scopeId: "JK6S7JQ2HsMj8m8RFI76",
      landlordId: "landlord-1",
      decisions: [
        {
          ...decision,
          id: "reduce_vacancy_risk:ZaeL9oqpJCSZPguWa6wR",
          title: "Decision reduce_vacancy_risk:ZaeL9oqpJCSZPguWa6wR",
          workflow: { ...decision.workflow, queue: "lease_review" },
        },
      ],
      leases: [
        {
          id: "JK6S7JQ2HsMj8m8RFI76",
          propertyName: "North Towers",
          unitNumber: "103",
          tenantName: "James Smith",
        },
      ],
      properties: [{ id: "ZaeL9oqpJCSZPguWa6wR", name: "North Towers" }],
    });

    const leaseContext = pack.sections.find((section) => section.sectionKey === "lease_context");
    const decisionLineage = pack.sections.find((section) => section.sectionKey === "decision_lineage");

    expect(leaseContext?.items[0]?.label).toBe("North Towers · Unit 103 · James Smith");
    expect(decisionLineage?.items[0]?.label).toBe("Vacancy pressure review");
    expect(pack.sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain(
      "Lease JK6S7JQ2HsMj8m8RFI76"
    );
    expect(pack.sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain(
      "Decision reduce_vacancy_risk:ZaeL9oqpJCSZPguWa6wR"
    );
  });

  it("groups repeated renewal notice draft snapshots as read-only audit context", () => {
    const pack = deriveEvidencePack({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      generatedAt: "2026-07-11T12:00:00.000Z",
      canonicalEvents: [
        {
          id: "event-draft-1",
          type: "renewal_notice_draft_saved",
          summary: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          occurredAt: "2026-07-11T12:00:00.000Z",
        },
        {
          id: "event-draft-2",
          type: "renewal_notice_draft_saved",
          summary: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          occurredAt: "2026-07-11T12:02:00.000Z",
        },
        {
          id: "event-draft-3",
          type: "renewal_notice_draft_saved",
          summary: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          occurredAt: "2026-07-11T12:04:00.000Z",
        },
      ],
      leases: [{ id: "lease-1", propertyName: "North Towers", unitNumber: "101", tenantName: "John Smith" }],
      properties: [{ id: "prop-1", name: "North Towers" }],
    });

    const auditSection = pack.sections.find((section) => section.sectionKey === "audit_events");
    const snapshotItems = auditSection?.items.filter((item) => item.label.includes("Renewal notice draft snapshot"));
    expect(snapshotItems).toHaveLength(1);
    expect(snapshotItems?.[0]).toEqual(
      expect.objectContaining({
        itemType: "canonical_event",
        label: "Renewal notice draft snapshots",
        description:
          "3 renewal notice draft snapshots saved. Latest saved at 2026-07-11 12:04 UTC. Not sent, not served, tenant not notified.",
        sourceId: "event-draft-3",
        timestamp: "2026-07-11T12:04:00.000Z",
      })
    );
    expect(JSON.stringify(pack)).not.toMatch(/Notice sent|Tenant notified|Notice served/);
  });

  it("shows renewal tenant communication records without raw message bodies or legal-service claims", () => {
    const pack = deriveEvidencePack({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      generatedAt: "2026-07-11T12:00:00.000Z",
      renewalNoticeCommunications: [
        {
          communicationId: "communication-1",
          leaseId: "lease-1",
          landlordId: "landlord-1",
          snapshotId: "snapshot-1",
          approvalDecisionItemId: "decision-1",
          recipientEmail: "hello+tenant@rentchain.ai",
          status: "email_sent",
          deliveryStatus: "delivery_status_unknown",
          attemptedAt: "2026-07-11T12:10:00.000Z",
          sentAt: "2026-07-11T12:10:02.000Z",
          tenantNotified: true,
          noticeServed: false,
          legalServiceEstablished: false,
          confirmation: {
            confirmationAccepted: true,
            recipientReviewed: true,
            bodyReviewed: true,
            legalServiceAcknowledged: true,
            noLegalServiceClaim: true,
          },
          generatedDraftText: "Hello Jane, private body text should not project.",
          providerPayload: { raw: "provider-secret" },
        },
        {
          communicationId: "communication-1",
          leaseId: "lease-1",
          landlordId: "landlord-1",
          snapshotId: "snapshot-1",
          approvalDecisionItemId: "decision-1",
          recipientEmail: "hello+tenant@rentchain.ai",
          status: "send_attempted",
          deliveryStatus: "delivery_status_unknown",
          attemptedAt: "2026-07-11T12:10:00.000Z",
          tenantNotified: false,
          noticeServed: false,
          legalServiceEstablished: false,
        },
      ],
      canonicalEvents: [
        {
          id: "event-confirmed-1",
          type: "renewal_notice_send_confirmed",
          summary: "Renewal tenant communication send confirmed internally. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          metadata: { communicationId: "communication-1" },
          occurredAt: "2026-07-11T12:09:58.000Z",
        },
        {
          id: "event-attempted-1",
          type: "renewal_notice_email_send_attempted",
          summary: "Renewal tenant communication send attempted. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          metadata: { communicationId: "communication-1" },
          occurredAt: "2026-07-11T12:10:00.000Z",
        },
        {
          id: "event-sent-1",
          type: "renewal_notice_email_sent",
          summary: "Renewal tenant communication email sent. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          metadata: { communicationId: "communication-1" },
          occurredAt: "2026-07-11T12:10:02.000Z",
        },
      ],
      leases: [{ id: "lease-1", propertyName: "North Towers", unitNumber: "101", tenantName: "John Smith" }],
      properties: [{ id: "prop-1", name: "North Towers" }],
    });

    const auditSection = pack.sections.find((section) => section.sectionKey === "audit_events");
    expect(auditSection?.items.filter((item) => item.itemType === "communication_record")).toHaveLength(1);
    expect(auditSection?.items.map((item) => item.label)).not.toEqual(
      expect.arrayContaining([
        "Renewal tenant communication send confirmed",
        "Renewal tenant communication send attempted",
        "Renewal tenant communication email sent",
      ])
    );
    expect(auditSection?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "communication_record",
          label: "Renewal tenant communication email sent",
          description:
            "Email accepted for sending at 2026-07-11 12:10 UTC. Communication ID: communication-1. Lease ID: lease-1. Context: North Towers · Unit 101 · John Smith. Recipient email: hello+tenant@rentchain.ai. Delivery confirmation: Not tracked yet. Draft snapshot ID: snapshot-1. Approval decision ID: decision-1. Confirmation/audit status: send confirmations captured. Not served; legal service not established. Legal compliance not determined by this workflow.",
          source: "renewal_notice_communications",
          sourceId: "communication-1",
        }),
      ])
    );
    expect(JSON.stringify(pack)).not.toMatch(/private body text|provider-secret|legally served|legal delivery|provider delivery confirmed|statutory compliance/i);
  });

  it("keeps raw provider, banking, debug, and private document fields out of evidence projections", () => {
    const pack = deriveEvidencePack({
      scope: "decision",
      scopeId: "decision-sensitive",
      landlordId: "landlord-1",
      decisions: [
        {
          ...decision,
          id: "decision-sensitive",
          title: "Missing payment review",
          description: "Payment evidence needs operational review.",
          rawPayload: { accountNumber: "111122223333" },
          providerPayload: { rawReport: "raw bureau report" },
          internalDebug: "routeSource=debug-router",
        },
      ],
      institutionExportPackage: exportPackage,
      auditComplianceReadiness: readiness,
      canonicalEvents: [
        {
          id: "event-sensitive",
          type: "payment_review_created",
          summary: "Payment review was created.",
          resource: { id: "decision-sensitive" },
          occurredAt: "2026-05-05T12:03:00.000Z",
          rawCsv: "account 111122223333",
          stack: "private stack trace",
        },
      ],
      leases: [
        {
          id: "lease-sensitive",
          leaseId: "lease-sensitive",
          propertyName: "North Towers",
          unitNumber: "104",
          tenantName: "Taylor Tenant",
          sin: "999-888-777",
          bankAccountNumber: "111122223333",
          privateDocument: "raw signed lease body",
        },
      ],
      properties: [
        {
          id: "prop-sensitive",
          name: "North Towers",
          routeSource: "internal-router",
        },
      ],
      maintenanceRequests: [
        {
          id: "maintenance-sensitive",
          title: "Maintenance review",
          rawReport: "private maintenance report",
        },
      ],
    });

    expectNoRestrictedProjectionFields(pack);
    expectPayloadDoesNotContainValues(pack, [
      "111122223333",
      "raw bureau report",
      "routeSource=debug-router",
      "account 111122223333",
      "private stack trace",
      "999-888-777",
      "raw signed lease body",
      "internal-router",
      "private maintenance report",
    ]);
  });
});
