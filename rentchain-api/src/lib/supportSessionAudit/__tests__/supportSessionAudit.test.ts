import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  SUPPORT_SESSION_AUDIT_VERSION,
  buildSupportSessionAuditRef,
  normalizeSupportAccessReason,
  normalizeSupportSessionResourceRefs,
  normalizeSupportSessionState,
} from "../supportSessionAudit";

describe("supportSessionAudit", () => {
  it("normalizes support session lifecycle states deterministically", () => {
    expect(normalizeSupportSessionState("Active")).toBe("active");
    expect(normalizeSupportSessionState("ended")).toBe("ended");
    expect(normalizeSupportSessionState("revoked")).toBe("revoked");
    expect(normalizeSupportSessionState("unknown-state")).toBe("requested");
  });

  it("normalizes support access reasons deterministically", () => {
    expect(normalizeSupportAccessReason("Customer Support")).toBe("customer_support");
    expect(normalizeSupportAccessReason("security-investigation")).toBe("security_investigation");
    expect(normalizeSupportAccessReason("evidence.review")).toBe("evidence_review");
    expect(normalizeSupportAccessReason("unsafe reason")).toBe("other");
  });

  it("keeps support session resource refs scoped and metadata-only", () => {
    const refs = normalizeSupportSessionResourceRefs(
      [
        {
          resourceType: "tenant",
          resourceId: "tenant-1",
          label: "Scoped tenant",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawProviderPayload: "raw-provider-data",
          token: "secret-token",
        },
        {
          resourceType: "lease",
          resourceId: "wrong-landlord-lease",
          label: "Wrong landlord lease",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
        },
        {
          resourceType: "evidence_pack",
          resourceId: "wrong-tenant-evidence",
          label: "Wrong tenant evidence",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
        },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(refs).toEqual([
      {
        resourceType: "tenant",
        resourceId: "tenant-1",
        label: "Scoped tenant",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        internalReference: true,
      },
    ]);
    expectNoRestrictedProjectionFields(refs);
    expectPayloadDoesNotContainValues(refs, [
      "raw-provider-data",
      "secret-token",
      "wrong-landlord-lease",
      "wrong-tenant-evidence",
    ]);
  });

  it("builds append-compatible support session audit refs without granting powers", () => {
    const auditRef = buildSupportSessionAuditRef({
      sessionId: "support session 1",
      sessionState: "active",
      accessReason: "incident review",
      actorId: "support-1",
      actorRole: "support",
      requestedBy: "admin-1",
      approvedBy: "admin-2",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      startedAt: "2026-05-22T10:00:00.000Z",
      occurredAt: "2026-05-22T10:05:00.000Z",
      resourceRefs: [
        {
          resourceType: "api_route",
          resourceId: "/api/admin/support-console/resource",
          label: "Support console resource route",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          routeSource: "supportConsoleRoutes.ts",
          debugPayload: { token: "secret-token" },
        },
      ],
      evidenceRefs: [
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-1",
          label: "Scoped evidence pack",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawEvidencePayload: "raw-evidence-data",
        },
      ],
      exportRefs: [
        {
          resourceType: "export_package",
          resourceId: "wrong-tenant-export",
          label: "Wrong tenant export",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
          rawExportPayload: "raw-export-data",
        },
      ],
      incidentRefs: [
        {
          resourceType: "incident",
          resourceId: "incident-1",
          label: "Security incident",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
        },
      ],
      reviewRefs: [
        {
          resourceType: "review_workspace",
          resourceId: "wrong-landlord-review",
          label: "Wrong landlord review",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
        },
      ],
      summary: "Support reviewed scoped incident metadata.",
    });

    expect(auditRef).toEqual(
      expect.objectContaining({
        supportSessionAuditVersion: SUPPORT_SESSION_AUDIT_VERSION,
        sessionId: "support_session_1",
        sessionState: "active",
        accessReason: "incident_review",
        actorId: "support-1",
        actorRole: "support",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        auditExpectation: "manual_append_only",
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        metadataOnly: true,
        appendCompatible: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        payloadSafety: {
          sensitiveData: "excluded",
          restrictedData: "excluded",
          providerData: "reference_only",
          evidenceData: "reference_only",
          exportData: "reference_only",
          credentialData: "excluded",
          diagnosticData: "metadata_only",
        },
      })
    );
    expect(auditRef.resourceRefs).toEqual([
      expect.objectContaining({
        resourceType: "api_route",
        resourceId: "/api/admin/support-console/resource",
        internalReference: true,
      }),
    ]);
    expect(auditRef.evidenceRefs).toEqual([
      expect.objectContaining({
        resourceType: "evidence_pack",
        resourceId: "evidence-1",
        internalReference: true,
      }),
    ]);
    expect(auditRef.exportRefs).toEqual([]);
    expect(auditRef.incidentRefs).toEqual([
      expect.objectContaining({
        resourceType: "incident",
        resourceId: "incident-1",
        internalReference: true,
      }),
    ]);
    expect(auditRef.reviewRefs).toEqual([]);
    expectNoRestrictedProjectionFields(auditRef);
    expectPayloadDoesNotContainValues(auditRef, [
      "secret-token",
      "raw-evidence-data",
      "raw-export-data",
      "wrong-tenant-export",
      "wrong-landlord-review",
      "routeSource",
      "debugPayload",
    ]);
  });

  it("does not imply tenant visibility, impersonation, support powers, or autonomous escalation", () => {
    const auditRef = buildSupportSessionAuditRef({
      sessionId: "support-session-2",
      sessionState: "requested",
      accessReason: "technical_diagnostics",
      actorId: "admin-1",
      actorRole: "admin",
      landlordId: "landlord-1",
      occurredAt: "2026-05-22T11:00:00.000Z",
      resourceRefs: [{ resourceType: "support_diagnostic", resourceId: "diag-1", landlordId: "landlord-1" }],
    });

    expect(auditRef).toEqual(
      expect.objectContaining({
        tenantVisible: false,
        metadataOnly: true,
        supportPowersGranted: false,
        impersonationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
      })
    );
  });

  it("normalizes invalid actor roles to unknown", () => {
    const auditRef = buildSupportSessionAuditRef({
      sessionId: "support-session-3",
      sessionState: "active",
      accessReason: "customer_support",
      actorId: "support-1",
      actorRole: "super-admin",
      landlordId: "landlord-1",
      occurredAt: "2026-05-22T12:00:00.000Z",
    });

    expect(auditRef.actorRole).toBe("unknown");
  });
});
