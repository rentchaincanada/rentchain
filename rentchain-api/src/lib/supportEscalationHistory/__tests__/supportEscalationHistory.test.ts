import { describe, expect, it } from "vitest";
import {
  buildSupportEscalationHistoryEntry,
  buildSupportEscalationReviewNote,
  normalizeSupportEscalationActionType,
  normalizeSupportEscalationNoteType,
} from "../supportEscalationHistory";

describe("supportEscalationHistory", () => {
  it("normalizes unsupported action and note types to safe non-mutating defaults", () => {
    expect(normalizeSupportEscalationActionType("auto_disable_account")).toBe("review_note_added");
    expect(normalizeSupportEscalationActionType("Manual Action Approved")).toBe("manual_action_approved");
    expect(normalizeSupportEscalationNoteType("raw_debug_note")).toBe("triage_note");
    expect(normalizeSupportEscalationNoteType("Security Review Note")).toBe("security_review_note");
  });

  it("builds append-only metadata history entries using runbook normalization", () => {
    const entry = buildSupportEscalationHistoryEntry({
      escalationRefId: "Escalation 1",
      category: "credential_secret",
      severity: "critical",
      state: "awaiting_approval",
      actionType: "approval_requested",
      actor: { id: "admin-raw-id", role: "admin", displayName: "Security operator" },
      occurredAt: "2026-05-23T12:00:00.000Z",
      noteSummary: "Credential family needs manual rotation review.",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      safeEvidenceRefs: [
        {
          referenceType: "incident",
          referenceId: "incident-1",
          label: "Credential incident",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
        },
      ],
    });

    expect(entry).toEqual(
      expect.objectContaining({
        escalationRefId: "escalation_1",
        category: "credential_secret",
        severity: "critical",
        state: "awaiting_approval",
        actionType: "approval_requested",
        approvalExpectation: "security_review",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousRemediationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        routeVisibilityChanged: false,
      })
    );
    expect(entry.actorSummary).toEqual({
      role: "admin",
      displayName: "Security operator",
      supportAttribution: true,
      rawActorIdsIncluded: false,
    });
    expect(entry.safeEvidenceRefs).toHaveLength(1);
    expect(JSON.stringify(entry)).not.toContain("admin-raw-id");
  });

  it("filters unsafe refs and strips restricted fields from history entries", () => {
    const entry = buildSupportEscalationHistoryEntry({
      escalationRefId: "escalation-2",
      category: "projection_safety",
      severity: "medium",
      state: "reviewing",
      actionType: "evidence_ref_added",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      noteSummary:
        "Bearer abc123 token=secret gs://bucket/raw.pdf stackTrace=do-not-copy requestBody={raw}",
      safeEvidenceRefs: [
        {
          referenceType: "evidence_pack",
          referenceId: "evidence-1",
          label: "gs://bucket/private.pdf?token=secret",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawPayload: { providerPayload: "restricted" },
          requestBody: { authorization: "Bearer secret" },
          responseBody: { rawReport: "restricted" },
          stackTrace: "debug trace",
        },
        {
          referenceType: "document",
          referenceId: "document-2",
          label: "Wrong landlord",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
        },
        {
          referenceType: "tenant",
          referenceId: "tenant-2",
          label: "Wrong tenant",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
        },
      ],
    });

    expect(entry.safeEvidenceRefs).toEqual([
      {
        referenceType: "evidence_pack",
        referenceId: "evidence-1",
        label: "evidence pack reference",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        internalReference: true,
        metadataOnly: true,
      },
    ]);
    expect(entry.noteSummary).toContain("[redacted authorization]");
    expect(entry.noteSummary).toContain("token=[redacted]");
    expect(entry.noteSummary).toContain("[redacted storage reference]");
    expect(JSON.stringify(entry)).not.toContain("providerPayload");
    expect(JSON.stringify(entry)).not.toContain("requestBody");
    expect(JSON.stringify(entry)).not.toContain("responseBody");
    expect(JSON.stringify(entry)).not.toContain("stackTrace");
    expect(JSON.stringify(entry)).not.toContain("gs://");
  });

  it("builds metadata-only manual review notes with redaction summary", () => {
    const note = buildSupportEscalationReviewNote({
      noteId: "Note 1",
      escalationRefId: "Escalation 1",
      noteType: "admin_review_note",
      noteSummary:
        "Reviewed policy outcome. authorization=Bearer-secret storage https://storage.googleapis.com/bucket/raw.pdf",
      author: { id: "support-raw-id", role: "support", displayName: "Support lead" },
      createdAt: "2026-05-23T13:00:00.000Z",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      resourceRefs: [
        {
          referenceType: "review_workspace",
          referenceId: "review-1",
          label: "Review workspace",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          debugPayload: "restricted",
        },
      ],
    });

    expect(note).toEqual(
      expect.objectContaining({
        noteId: "note_1",
        escalationRefId: "escalation_1",
        noteType: "admin_review_note",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousRemediationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        routeVisibilityChanged: false,
      })
    );
    expect(note.authorSummary).toEqual({
      role: "support",
      displayName: "Support lead",
      supportAttribution: true,
      rawActorIdsIncluded: false,
    });
    expect(note.noteSummary).toContain("authorization=[redacted]");
    expect(note.noteSummary).toContain("[redacted storage reference]");
    expect(note.redactionSummary).toContain("metadata-only summary");
    expect(JSON.stringify(note)).not.toContain("support-raw-id");
    expect(JSON.stringify(note)).not.toContain("debugPayload");
  });

  it("fails unsupported inputs into safe defaults", () => {
    const entry = buildSupportEscalationHistoryEntry({
      escalationRefId: "",
      category: "auto_remediation",
      severity: "urgent",
      state: "auto_resolved",
      actionType: "disable_user",
      occurredAt: "not-a-date",
      noteSummary: "",
    });
    const note = buildSupportEscalationReviewNote({
      noteType: "raw_payload_note",
      createdAt: "not-a-date",
      noteSummary: "",
    });

    expect(entry.escalationRefId).toBe("support_escalation_unknown");
    expect(entry.category).toBe("other");
    expect(entry.severity).toBe("low");
    expect(entry.state).toBe("triage_required");
    expect(entry.actionType).toBe("review_note_added");
    expect(entry.occurredAt).toBe("1970-01-01T00:00:00.000Z");
    expect(entry.noteSummary).toBe("Manual support escalation note recorded as metadata-only summary.");
    expect(note.noteType).toBe("triage_note");
    expect(note.createdAt).toBe("1970-01-01T00:00:00.000Z");
    expect(note.autonomousRemediationEnabled).toBe(false);
  });
});
