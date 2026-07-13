import { describe, expect, it } from "vitest";
import { deriveCanonicalReviewTimeline } from "../deriveCanonicalReviewTimeline";

const decision = {
  id: "decision-1",
  title: "Review overdue rent",
  description: "Rent is overdue.",
  status: "open",
  destination: "/leases/lease-1/ledger",
  updatedAt: "2026-05-05T12:00:00.000Z",
  workflow: {
    queue: "delinquency_review",
    workflowState: "new",
    escalationLevel: "critical",
  },
};

const reviewSession = {
  reviewSessionId: "review-1",
  landlordId: "landlord-1",
  scope: "decision",
  scopeId: "decision-1",
  status: "completed",
  openedAt: "2026-05-05T12:01:00.000Z",
  closedAt: "2026-05-05T12:03:00.000Z",
  openedBy: { userId: "landlord-1", role: "landlord" },
  notes: [{ noteId: "note-1", text: "Reviewed evidence", createdAt: "2026-05-05T12:02:00.000Z", actor: { userId: "landlord-1", role: "landlord" } }],
  outcome: {
    result: "reviewed",
    summary: "Reviewed by operator",
    recordedAt: "2026-05-05T12:03:00.000Z",
    recordedBy: { userId: "landlord-1", role: "landlord" },
  },
  updatedAt: "2026-05-05T12:03:00.000Z",
};

const evidencePack = {
  evidencePackId: "evidence-1",
  status: "incomplete",
  generatedAt: "2026-05-05T12:04:00.000Z",
  summary: { totalItems: 3 },
  blockedReasons: [],
  redactions: [{ fieldCategory: "payment_account_details", reason: "Payment account details are excluded." }],
};

const exportPackage = {
  packageId: "export-1",
  status: "preview_ready",
  generatedAt: "2026-05-05T12:05:00.000Z",
  blockedReasons: [],
};

const readiness = {
  readinessId: "readiness-1",
  generatedAt: "2026-05-05T12:06:00.000Z",
  checks: [
    {
      checkKey: "audit_event_coverage",
      label: "Audit event coverage",
      status: "needs_attention",
      evidence: [],
      missingEvidence: ["No canonical events available."],
      blockedReasons: [],
    },
    {
      checkKey: "external_submission_disabled",
      label: "External submission disabled",
      status: "passed",
      evidence: ["No external filing is enabled."],
      missingEvidence: [],
      blockedReasons: [],
    },
  ],
};

describe("deriveCanonicalReviewTimeline", () => {
  it("derives a deterministic read-only timeline with chronology, actors, redactions, and flags", () => {
    const timeline = deriveCanonicalReviewTimeline({
      scope: "decision",
      scopeId: "decision-1",
      landlordId: "landlord-1",
      generatedAt: "2026-05-05T12:07:00.000Z",
      decisions: [decision],
      operatorReviewSessions: [reviewSession],
      evidencePack,
      institutionExportPackage: exportPackage,
      auditComplianceReadiness: readiness,
      canonicalEvents: [
        {
          id: "event-1",
          type: "operator_review_session_closed",
          summary: "Review closed",
          resource: { id: "decision-1" },
          actor: { type: "landlord", id: "landlord-1" },
          occurredAt: "2026-05-05T12:03:00.000Z",
        },
      ],
    });

    expect(timeline.timelineId).toBe("canonical_review_timeline:decision:landlord-1:decision-1");
    expect(timeline.manualReviewRequired).toBe(true);
    expect(timeline.externalSharingEnabled).toBe(false);
    expect(timeline.certificationIssued).toBe(false);
    expect(timeline.entries.map((item) => item.timestamp)).toEqual([...timeline.entries.map((item) => item.timestamp)].sort());
    expect(timeline.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryType: "delinquency_review", source: "decision_inbox", label: "Review overdue rent" }),
        expect.objectContaining({ entryType: "workflow_transition", source: "workflow_routing", status: "blocked" }),
        expect.objectContaining({ entryType: "operator_review", label: "Review note added", actor: { type: "landlord", id: "landlord-1" } }),
        expect.objectContaining({ entryType: "canonical_event", source: "canonical_events" }),
        expect.objectContaining({ entryType: "redaction_note", status: "redacted", redacted: true }),
        expect.objectContaining({ entryType: "export_preview", source: "institution_exports" }),
        expect.objectContaining({ entryType: "readiness_check", source: "audit_compliance" }),
      ])
    );
    expect(timeline.summary.redacted).toBe(1);
  });

  it("filters by entry type, status, and source without mutating source records", () => {
    const sourceDecision = JSON.parse(JSON.stringify(decision));
    const timeline = deriveCanonicalReviewTimeline({
      scope: "decision",
      scopeId: "decision-1",
      landlordId: "landlord-1",
      decisions: [sourceDecision],
      evidencePack,
      filters: { entryType: "redaction_note", status: "redacted", source: "evidence_packs" },
    });

    expect(timeline.entries).toHaveLength(1);
    expect(timeline.entries[0]).toEqual(expect.objectContaining({ entryType: "redaction_note", status: "redacted" }));
    expect(sourceDecision).toEqual(decision);
  });

  it("uses stable ordering for identical timestamps", () => {
    const timeline = deriveCanonicalReviewTimeline({
      scope: "decision",
      scopeId: "decision-1",
      landlordId: "landlord-1",
      decisions: [
        { ...decision, id: "decision-b", updatedAt: "2026-05-05T12:00:00.000Z" },
        { ...decision, id: "decision-a", updatedAt: "2026-05-05T12:00:00.000Z" },
      ],
    });

    expect(timeline.entries.map((item) => item.timelineEntryId)).toEqual([...timeline.entries.map((item) => item.timelineEntryId)].sort());
  });

  it("labels renewal notice draft saved events without implying delivery", () => {
    const timeline = deriveCanonicalReviewTimeline({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      canonicalEvents: [
        {
          id: "event-draft-1",
          type: "renewal_notice_draft_saved",
          action: "renewal_notice_draft_saved",
          summary: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          actor: { type: "landlord", id: "landlord-1" },
          occurredAt: "2026-07-11T12:00:00.000Z",
        },
      ],
    });

    expect(timeline.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "canonical_event",
          source: "canonical_events",
          label: "Renewal notice draft saved",
          description: "Renewal notice draft saved. Not sent, not served, tenant not notified.",
        }),
      ])
    );
    expect(JSON.stringify(timeline)).not.toMatch(/Notice sent|Tenant notified|Notice served/);
  });

  it("labels renewal tenant communication send events with legal-service guardrails", () => {
    const timeline = deriveCanonicalReviewTimeline({
      scope: "lease",
      scopeId: "lease-1",
      landlordId: "landlord-1",
      renewalNoticeCommunications: [
        {
          communicationId: "rnc_test",
          leaseId: "lease-1",
          snapshotId: "snapshot-1",
          approvalDecisionItemId: "decision-1",
          recipientEmail: "hello+tenant@rentchain.ai",
          status: "email_sent",
          deliveryStatus: "delivery_status_unknown",
          sentAt: "2026-07-11T12:10:00.000Z",
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
      ],
      canonicalEvents: [
        {
          id: "event-confirmed-1",
          type: "renewal_notice_send_confirmed",
          action: "renewal_notice_send_confirmed",
          summary: "Renewal tenant communication send confirmed internally. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          actor: { type: "landlord", id: "landlord-1" },
          payload: {
            communicationId: "rnc_test",
            deliveryStatus: "delivery_status_unknown",
            tenantNotified: false,
          },
          occurredAt: "2026-07-11T12:09:58.000Z",
        },
        {
          id: "event-attempted-1",
          type: "renewal_notice_email_send_attempted",
          action: "renewal_notice_email_send_attempted",
          summary: "Renewal tenant communication send attempted. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          actor: { type: "landlord", id: "landlord-1" },
          payload: {
            communicationId: "rnc_test",
            deliveryStatus: "delivery_status_unknown",
            tenantNotified: false,
          },
          occurredAt: "2026-07-11T12:10:00.000Z",
        },
        {
          id: "event-send-1",
          type: "renewal_notice_email_sent",
          action: "renewal_notice_email_sent",
          summary: "Renewal tenant communication email sent. Not served; legal service not established.",
          leaseId: "lease-1",
          resource: { id: "lease-1" },
          actor: { type: "landlord", id: "landlord-1" },
          metadata: {
            communicationId: "rnc_test",
            deliveryStatus: "delivery_status_unknown",
            tenantNotified: true,
          },
          occurredAt: "2026-07-11T12:10:00.000Z",
        },
      ],
    });

    expect(timeline.entries.map((entry) => entry.label)).toEqual(
      expect.arrayContaining([
        "Renewal tenant communication send confirmed",
        "Renewal tenant communication send attempted",
        "Renewal tenant communication email sent",
      ])
    );
    expect(timeline.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "canonical_event",
          source: "canonical_events",
          label: "Renewal tenant communication email sent",
          description:
            "Renewal tenant communication email sent at 2026-07-11 12:10 UTC. Communication ID: rnc_test. Status: email sent. Recipient email: hello+tenant@rentchain.ai. Delivery confirmation: Not tracked yet. Draft snapshot ID: snapshot-1. Approval decision ID: decision-1. Confirmation/audit status: send confirmations captured. Not served; legal service not established. Legal compliance not determined by this workflow.",
        }),
        expect.objectContaining({
          label: "Renewal tenant communication send attempted",
          description:
            "Renewal tenant communication send attempted at 2026-07-11 12:10 UTC. Communication ID: rnc_test. Status: send attempted. Recipient email: hello+tenant@rentchain.ai. Delivery confirmation: Not tracked yet. Draft snapshot ID: snapshot-1. Approval decision ID: decision-1. Confirmation/audit status: send confirmations captured. Not served; legal service not established. Legal compliance not determined by this workflow.",
        }),
        expect.objectContaining({
          label: "Renewal tenant communication send confirmed",
          description:
            "Renewal tenant communication send confirmed internally at 2026-07-11 12:09 UTC. Communication ID: rnc_test. Status: send confirmed internally. Recipient email: hello+tenant@rentchain.ai. Delivery confirmation: Not tracked yet. Draft snapshot ID: snapshot-1. Approval decision ID: decision-1. Confirmation/audit status: send confirmations captured. Not served; legal service not established. Legal compliance not determined by this workflow.",
        }),
      ])
    );
    expect(JSON.stringify(timeline)).not.toMatch(/private body text|provider-secret|legally served|legal delivery|compliant notice|provider delivery confirmed/i);
  });
});
