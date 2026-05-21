import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION,
  buildPrivilegedAccessAuditRef,
  classifyAdminSupportScope,
  normalizePrivilegedAccessResourceRefs,
} from "../adminSupportAccessGovernance";

describe("adminSupportAccessGovernance", () => {
  it("keeps landlord access scoped to the landlord context", () => {
    const context = classifyAdminSupportScope({
      authority: {
        actorId: "landlord-user-1",
        actorRole: "landlord",
        effectiveLandlordId: "landlord-1",
        effectiveTenantId: null,
        isAdmin: false,
        isSupport: false,
        isLandlord: true,
        isTenant: false,
        warnings: [],
        errors: [],
      },
      requestedLandlordId: "landlord-1",
    });

    expect(context).toEqual(
      expect.objectContaining({
        governanceVersion: ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION,
        accessMode: "landlord_operational",
        visibilityClass: "landlord_operational",
        tenantVisible: false,
        crossLandlordVisibilityEnabled: false,
        impersonationEnabled: false,
        autonomousEscalationEnabled: false,
        financialMutationEnabled: false,
        errors: [],
      })
    );
  });

  it("does not infer admin global access without explicit system-admin context", () => {
    const context = classifyAdminSupportScope({
      authority: {
        actorId: "admin-1",
        actorRole: "admin",
        effectiveLandlordId: "admin-1",
        effectiveTenantId: null,
        isAdmin: true,
        isSupport: false,
        isLandlord: false,
        isTenant: false,
        warnings: [],
        errors: [],
      },
    });

    expect(context.accessMode).toBe("denied");
    expect(context.errors).toContain("admin_scope_required");

    const scoped = classifyAdminSupportScope({
      authority: {
        ...context,
        errors: [],
        warnings: [],
        actorRole: "admin",
        effectiveLandlordId: "admin-1",
        isAdmin: true,
        isSupport: false,
        isLandlord: false,
        isTenant: false,
      },
      requestedLandlordId: "landlord-1",
    });
    expect(scoped.accessMode).toBe("admin_scoped_review");
  });

  it("requires support access to be scoped and remains internal-only", () => {
    const unscoped = classifyAdminSupportScope({
      authority: {
        actorId: "support-1",
        actorRole: "support",
        effectiveLandlordId: "support-1",
        effectiveTenantId: null,
        isAdmin: false,
        isSupport: true,
        isLandlord: false,
        isTenant: false,
        warnings: [],
        errors: [],
      },
    });

    expect(unscoped.accessMode).toBe("denied");
    expect(unscoped.errors).toContain("support_scope_required");

    const scoped = classifyAdminSupportScope({
      authority: {
        ...unscoped,
        actorRole: "support",
        isAdmin: false,
        isSupport: true,
        isLandlord: false,
        isTenant: false,
        errors: [],
        warnings: [],
      },
      requestedLandlordId: "landlord-1",
      requestedTenantId: "tenant-1",
    });

    expect(scoped).toEqual(
      expect.objectContaining({
        accessMode: "support_scoped_diagnostic",
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        impersonationEnabled: false,
      })
    );
  });

  it("denies tenant use of privileged access context", () => {
    const context = classifyAdminSupportScope({
      authority: {
        actorId: "tenant-1",
        actorRole: "tenant",
        effectiveLandlordId: "landlord-1",
        effectiveTenantId: "tenant-1",
        isAdmin: false,
        isSupport: false,
        isLandlord: false,
        isTenant: true,
        warnings: [],
        errors: [],
      },
      requestedLandlordId: "landlord-1",
      requestedTenantId: "tenant-1",
    });

    expect(context.accessMode).toBe("denied");
    expect(context.errors).toContain("tenant_cannot_use_privileged_access");
    expect(context.tenantVisible).toBe(false);
  });

  it("filters privileged resource refs to the requested scope and omits raw payload fields", () => {
    const refs = normalizePrivilegedAccessResourceRefs(
      [
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-1",
          label: "Scoped evidence",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawPayload: "raw provider dump",
          token: "secret-token",
        },
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-2",
          label: "Wrong landlord",
          landlordId: "landlord-2",
          tenantId: "tenant-1",
        },
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-3",
          label: "Wrong tenant",
          landlordId: "landlord-1",
          tenantId: "tenant-2",
        },
      ],
      { landlordId: "landlord-1", tenantId: "tenant-1" }
    );

    expect(refs).toEqual([
      {
        resourceType: "evidence_pack",
        resourceId: "evidence-1",
        label: "Scoped evidence",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        internalReference: true,
      },
    ]);
    expectNoRestrictedProjectionFields(refs);
    expectPayloadDoesNotContainValues(refs, ["raw provider dump", "secret-token", "evidence-2", "evidence-3"]);
  });

  it("builds metadata-only audit refs without autonomous escalation or tenant-visible internals", () => {
    const context = classifyAdminSupportScope({
      authority: {
        actorId: "admin-1",
        actorRole: "admin",
        effectiveLandlordId: "admin-1",
        effectiveTenantId: null,
        isAdmin: true,
        isSupport: false,
        isLandlord: false,
        isTenant: false,
        warnings: [],
        errors: [],
      },
      requestedLandlordId: "landlord-1",
      requestedTenantId: "tenant-1",
    });

    const auditRef = buildPrivilegedAccessAuditRef({
      context,
      action: "Evidence Access Review",
      occurredAt: "2026-05-21T12:00:00.000Z",
      summary: "Admin reviewed scoped evidence metadata.",
      resourceRefs: [
        {
          resourceType: "review_workspace",
          resourceId: "workspace-1",
          label: "Review workspace",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          providerPayload: "raw provider dump",
          stack: "private stack trace",
        },
      ],
      evidenceRefs: [
        {
          resourceType: "evidence_pack",
          resourceId: "evidence-1",
          label: "Evidence pack reference",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          webhookSecret: "whsec_sensitive",
        },
      ],
    });

    expect(auditRef).toEqual(
      expect.objectContaining({
        governanceVersion: ADMIN_SUPPORT_ACCESS_GOVERNANCE_VERSION,
        auditRefId: "privileged_access:admin-1:evidence_access_review:2026-05-21t12:00:00.000z",
        accessMode: "admin_scoped_review",
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        metadataOnly: true,
        supportSafe: true,
        sensitivePayloadIncluded: false,
        restrictedPayloadIncluded: false,
        autonomousEscalationEnabled: false,
      })
    );
    expectNoRestrictedProjectionFields(auditRef);
    expectPayloadDoesNotContainValues(auditRef, ["raw provider dump", "private stack trace", "whsec_sensitive"]);
  });
});
