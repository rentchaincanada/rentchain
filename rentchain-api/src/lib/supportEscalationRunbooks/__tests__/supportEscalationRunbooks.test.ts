import { describe, expect, it } from "vitest";
import {
  approvalRequirementForEscalation,
  buildSupportEscalationRunbookRef,
  buildSupportEscalationRunbookTemplate,
  normalizeSupportEscalationCategory,
  normalizeSupportEscalationRefs,
  normalizeSupportEscalationSeverity,
  normalizeSupportEscalationState,
} from "../supportEscalationRunbooks";

describe("supportEscalationRunbooks", () => {
  it("normalizes categories, severities, and manual states deterministically", () => {
    expect(normalizeSupportEscalationCategory("Projection Safety")).toBe("projection_safety");
    expect(normalizeSupportEscalationCategory("unknown-new-signal")).toBe("other");
    expect(normalizeSupportEscalationSeverity("CRITICAL")).toBe("critical");
    expect(normalizeSupportEscalationSeverity("unexpected")).toBe("low");
    expect(normalizeSupportEscalationState("Awaiting Approval")).toBe("awaiting_approval");
    expect(normalizeSupportEscalationState("auto_resolved")).toBe("triage_required");
  });

  it("derives approval requirements without granting action authority", () => {
    expect(approvalRequirementForEscalation({ category: "credential_secret", severity: "low" })).toBe("security_review");
    expect(approvalRequirementForEscalation({ category: "projection_safety", severity: "medium" })).toBe("admin_review");
    expect(approvalRequirementForEscalation({ category: "api_abuse", severity: "critical" })).toBe("security_review");
    expect(approvalRequirementForEscalation({ category: "technical_diagnostics", severity: "low" })).toBe(
      "none_for_metadata_review"
    );
  });

  it("builds metadata-only runbook templates with prohibited autonomous actions", () => {
    const template = buildSupportEscalationRunbookTemplate({
      category: "tenant_data_exposure",
      severity: "high",
    });

    expect(template).toEqual(
      expect.objectContaining({
        category: "tenant_data_exposure",
        severity: "high",
        approvalRequirement: "security_review",
        metadataOnly: true,
        autonomousActionEnabled: false,
      })
    );
    expect(template.manualSteps.join(" ")).toContain("projection boundary");
    expect(template.prohibitedActions.join(" ")).toContain("Do not perform autonomous remediation");
  });

  it("filters refs by scoped landlord and tenant and avoids raw labels", () => {
    const refs = normalizeSupportEscalationRefs(
      [
        {
          referenceType: "incident",
          referenceId: "incident-1",
          label: "<Incident> metadata",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawPayload: { secret: "do-not-copy" },
        },
        {
          referenceType: "document",
          referenceId: "document-1",
          label: "Document ref",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
          storagePath: "gs://bucket/private.pdf",
        },
        {
          referenceType: "tenant",
          referenceId: "tenant-2",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
        },
        {
          referenceType: "document",
          referenceId: "document-2",
          label: "gs://bucket/private.pdf?token=do-not-copy",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          requestBody: { authorization: "Bearer secret" },
          responseBody: { rawReport: "restricted" },
          stackTrace: "debug trace",
        },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({
      referenceType: "document",
      referenceId: "document-2",
      label: "document reference",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true,
      metadataOnly: true,
    });
    expect(refs[1]).toEqual({
      referenceType: "incident",
      referenceId: "incident-1",
      label: "Incident metadata",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true,
      metadataOnly: true,
    });
    expect(JSON.stringify(refs)).not.toContain("secret");
    expect(JSON.stringify(refs)).not.toContain("storagePath");
    expect(JSON.stringify(refs)).not.toContain("gs://");
    expect(JSON.stringify(refs)).not.toContain("requestBody");
    expect(JSON.stringify(refs)).not.toContain("responseBody");
    expect(JSON.stringify(refs)).not.toContain("stackTrace");
  });

  it("builds non-granting support escalation runbook refs", () => {
    const runbook = buildSupportEscalationRunbookRef({
      escalationId: "Escalation 1",
      category: "impersonation_review",
      severity: "medium",
      state: "reviewing",
      requestedBy: "admin-user-1",
      assignedTo: "support-lead-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      occurredAt: "2026-05-23T12:00:00.000Z",
      incidentRefs: [
        {
          referenceType: "incident",
          referenceId: "incident-1",
          label: "Impersonation lifecycle incident",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
        },
      ],
      evidenceRefs: [
        {
          referenceType: "evidence_pack",
          referenceId: "evidence-1",
          label: "Evidence lineage",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          providerPayload: { report: "restricted" },
        },
      ],
    });

    expect(runbook).toEqual(
      expect.objectContaining({
        escalationId: "escalation_1",
        category: "impersonation_review",
        severity: "medium",
        state: "reviewing",
        approvalRequirement: "admin_review",
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        metadataOnly: true,
        appendCompatible: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousRemediationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        routeVisibilityChanged: false,
      })
    );
    expect(runbook.incidentRefs).toHaveLength(1);
    expect(runbook.evidenceRefs).toHaveLength(1);
    expect(JSON.stringify(runbook)).not.toContain("restricted");
  });

  it("falls back safely for unsupported inputs", () => {
    const runbook = buildSupportEscalationRunbookRef({
      category: "auto-fix-account",
      severity: "urgent-now",
      state: "autonomous_remediation",
      occurredAt: "not-a-date",
    });

    expect(runbook.category).toBe("other");
    expect(runbook.severity).toBe("low");
    expect(runbook.state).toBe("triage_required");
    expect(runbook.occurredAt).toBe("1970-01-01T00:00:00.000Z");
    expect(runbook.approvalRequirement).toBe("none_for_metadata_review");
    expect(runbook.autonomousRemediationEnabled).toBe(false);
  });
});
