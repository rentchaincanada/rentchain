import { describe, expect, it } from "vitest";

import {
  buildAdminSupportEscalationReviewDetail,
  buildAdminSupportEscalationReviewRecords,
  emptyAdminSupportEscalationReviewSummary,
  filterAdminSupportEscalationReviewRecords,
} from "../adminSupportEscalationReview";

const history = [
  {
    escalationRefId: "escalation-1",
    category: "credential_secret",
    severity: "critical",
    state: "awaiting_approval",
    actionType: "approval_requested",
    actor: { id: "raw-admin-id", role: "admin", displayName: "Security operator" },
    occurredAt: "2026-05-23T12:00:00.000Z",
    noteSummary: "Bearer abc token=secret gs://bucket/raw.pdf",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    safeEvidenceRefs: [
      {
        referenceType: "incident",
        referenceId: "incident-1",
        label: "Credential incident",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        rawProviderPayload: "restricted",
      },
      {
        referenceType: "document",
        referenceId: "unrelated-document",
        label: "Unrelated document",
        landlordId: "other-landlord",
        storagePath: "gs://bucket/raw.pdf",
      },
    ],
  },
];

const notes = [
  {
    escalationRefId: "escalation-1",
    noteType: "security_review_note",
    noteSummary: "authorization=Bearer-secret https://storage.googleapis.com/bucket/raw.pdf",
    author: { id: "raw-support-id", role: "support", displayName: "Support lead" },
    createdAt: "2026-05-23T13:00:00.000Z",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    safeEvidenceRefs: [
      {
        referenceType: "review_workspace",
        referenceId: "review-1",
        label: "Review workspace",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        debugPayload: "restricted",
      },
    ],
  },
];

describe("admin support escalation review read model", () => {
  it("groups history and notes into metadata-only admin/support records", () => {
    const [record] = buildAdminSupportEscalationReviewRecords({ history, notes });

    expect(record).toEqual(
      expect.objectContaining({
        escalationId: "escalation-1",
        category: "credential_secret",
        severity: "critical",
        state: "awaiting_approval",
        approvalExpectation: "security_review",
        historyCount: 1,
        noteCount: 1,
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
      })
    );
    expect(record.safeEvidenceRefs.map((ref) => ref.referenceId).sort()).toEqual(["incident-1", "review-1"]);

    const payload = JSON.stringify(record);
    expect(payload).not.toContain("raw-admin-id");
    expect(payload).not.toContain("raw-support-id");
    expect(payload).not.toContain("Bearer-secret");
    expect(payload).not.toContain("rawProviderPayload");
    expect(payload).not.toContain("debugPayload");
    expect(payload).not.toContain("gs://");
    expect(payload).not.toContain("storage.googleapis.com");
    expect(payload).not.toContain("unrelated-document");
  });

  it("builds safe details without exposing mutation controls or raw payloads", () => {
    const detail = buildAdminSupportEscalationReviewDetail("escalation-1", { history, notes });

    expect(detail).toEqual(
      expect.objectContaining({
        escalationId: "escalation-1",
        metadataOnly: true,
        emptyState: false,
        historyEntries: expect.any(Array),
        reviewNotes: expect.any(Array),
        prohibitedActions: expect.arrayContaining(["Do not perform autonomous remediation."]),
      })
    );
    expect(detail?.historyEntries[0]).toEqual(
      expect.objectContaining({
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousRemediationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        routeVisibilityChanged: false,
      })
    );
    expect(JSON.stringify(detail)).not.toContain("Bearer-secret");
    expect(JSON.stringify(detail)).not.toContain("storage.googleapis.com");
  });

  it("filters records deterministically and keeps empty state explicit", () => {
    const records = buildAdminSupportEscalationReviewRecords({
      history: [
        ...history,
        {
          escalationRefId: "escalation-2",
          category: "api_abuse",
          severity: "low",
          state: "triage_required",
          occurredAt: "2026-05-23T14:00:00.000Z",
        },
      ],
      notes,
    });

    expect(filterAdminSupportEscalationReviewRecords(records, { severity: "critical" })).toHaveLength(1);
    expect(filterAdminSupportEscalationReviewRecords(records, { q: "api abuse" })).toHaveLength(1);
    expect(emptyAdminSupportEscalationReviewSummary()).toEqual(
      expect.objectContaining({
        total: 0,
        metadataOnly: true,
        emptyState: expect.stringContaining("No persisted support escalation history"),
      })
    );
  });
});
