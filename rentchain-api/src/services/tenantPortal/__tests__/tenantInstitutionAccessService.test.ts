import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
let generatedId = 0;

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

const dbMock = {
  collection: (name: string) => ({
    async get() {
      const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
        id,
        data: () => data,
      }));
      return { docs, empty: docs.length === 0 };
    },
    doc: (id?: string) => {
      const resolvedId = id || `generated-${++generatedId}`;
      return {
        id: resolvedId,
        async get() {
          const entry = ensureCollection(name).get(resolvedId);
          return {
            id: resolvedId,
            exists: Boolean(entry),
            data: () => entry,
          };
        },
        async set(payload: any, options?: { merge?: boolean }) {
          const current = ensureCollection(name).get(resolvedId) || {};
          ensureCollection(name).set(resolvedId, options?.merge ? { ...current, ...(payload || {}) } : payload || {});
        },
      };
    },
    where: (field: string, _op: string, value: any) => ({
      limit: (_count: number) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => data?.[field] === value)
            .map(([id, data]) => ({
              id,
              data: () => data,
            }));
          return { docs, empty: docs.length === 0 };
        },
      }),
    }),
  }),
};

const resolveTenancyContext = vi.fn();
const loadTenantIdentityRecord = vi.fn();

vi.mock("../../../config/firebase", () => ({ db: dbMock }));
vi.mock("../tenancyContextService", () => ({ resolveTenancyContext }));
vi.mock("../tenantProfileService", () => ({ loadTenantIdentityRecord }));

describe("tenantInstitutionAccessService", () => {
  beforeEach(() => {
    collections.clear();
    generatedId = 0;
    vi.clearAllMocks();
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      leaseId: "lease-1",
    });
    ensureCollection("leases").set("lease-1", {
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      dueDay: 1,
    });
    resolveTenancyContext.mockResolvedValue({
      ok: true,
      authority: "active_tenant",
      propertyId: "prop-1",
      applicationId: "app-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
    });
    loadTenantIdentityRecord.mockResolvedValue({
      identityStatus: "verified",
      profile: { completionStatus: "complete" },
      application: { reusable: true, lastSubmittedAt: "2026-04-20T00:00:00.000Z" },
      documents: { completionStatus: "complete", missingCategories: [] },
      screening: { status: "completed", lastCompletedAt: "2026-04-21T00:00:00.000Z" },
      leases: { activeCount: 1, historicalCount: 1, lastSignedAt: "2026-04-22T00:00:00.000Z" },
      verification: { level: "strong" },
      readinessLabel: "Well established",
      readinessDescription: "Completed verification signals are available.",
    });
  });

  it("previews metadata-only institution access and blocks package summaries until consent", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const preview = await service.previewTenantInstitutionAccess({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "Reviewer@Example.com", displayName: "Reviewer", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: false,
    });

    expect(preview?.lifecycle).toBe("consent_required");
    expect(preview?.recipient.email).toBe("reviewer@example.com");
    expect(preview?.includedClaims).toEqual([]);
    expect(preview?.excludedClaims.length).toBeGreaterThan(0);
    expect(preview?.recipientAccess).toEqual(
      expect.objectContaining({
        enabled: false,
        accessUrl: null,
        accessTokenIssued: false,
        recipientAuthenticationRequired: true,
        downloadEnabled: false,
      })
    );
    const payload = JSON.stringify(preview || {});
    expect(payload).not.toContain("documentUrl");
    expect(payload).not.toContain("paymentMethod");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("externalSubmissionEnabled\":true");
  });

  it("requires consent, recipient, and expiration before creating an access grant", async () => {
    const service = await import("../tenantInstitutionAccessService");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        recipient: { email: "reviewer@example.com" },
        expiresInDays: 7,
        consentAccepted: false,
      })
    ).rejects.toThrow("tenant_institution_access_consent_required");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        expiresInDays: 7,
        consentAccepted: true,
      })
    ).rejects.toThrow("tenant_institution_access_recipient_required");

    await expect(
      service.createTenantInstitutionAccessGrant({
        tenantId: "tenant-1",
        audience: "insurer",
        recipient: { email: "reviewer@example.com" },
        consentAccepted: true,
      })
    ).rejects.toThrow("tenant_institution_access_expiration_required");
  });

  it("creates, lists, and revokes tenant-owned access grants without public exposure", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "lender",
      recipient: { email: "underwriter@example.com", organizationName: "Example Lender" },
      expiresInDays: 14,
      consentAccepted: true,
    });

    expect(grant?.lifecycle).toBe("active");
    expect(grant?.consent.granted).toBe(true);
    expect(grant?.package.status).toBe("export_ready");
    expect(grant?.recipientAccess.enabled).toBe(false);
    expect(grant?.publicProfileEnabled).toBe(false);
    expect(grant?.events.map((event) => event.eventType)).toContain("tenant_institution_access_granted");
    const payload = JSON.stringify(grant || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("externalSubmissionEnabled\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(ensureCollection("tenantInstitutionAccessGrants").size).toBe(1);
    expect(Array.from(ensureCollection("tenantInstitutionAccessGrants").values())[0]?.tenantId).toBe("tenant-1");

    const listed = await service.listTenantInstitutionAccessGrants({ tenantId: "tenant-1" });
    expect(listed).toHaveLength(1);
    expect(listed[0].grantId).toBe(grant?.grantId);

    const blocked = await service.revokeTenantInstitutionAccessGrant({
      tenantId: "tenant-2",
      grantId: grant?.grantId || "",
    });
    expect(blocked).toBe(false);

    const revoked = await service.revokeTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      grantId: grant?.grantId || "",
    });
    expect(revoked && revoked.lifecycle).toBe("revoked");
    expect(revoked && revoked.consent.granted).toBe(false);
    expect(revoked && revoked.recipientAccess.enabled).toBe(false);
    expect(revoked && revoked.package.exportSummaries.length).toBeGreaterThan(0);
  });

  it("allows only the intended authenticated recipient to view metadata-only review summaries", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const grant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com", organizationName: "Example Insurance" },
      expiresInDays: 7,
      consentAccepted: true,
    });

    const unauthenticated = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
    });
    expect(unauthenticated.decision.allowed).toBe(false);
    expect(unauthenticated.decision.status).toBe("unauthenticated");

    const wrongRecipient = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "other@example.com",
    });
    expect(wrongRecipient.decision.allowed).toBe(false);
    expect(wrongRecipient.decision.status).toBe("recipient_mismatch");

    const review = await service.getRecipientTrustReview({
      grantId: grant?.grantId || "",
      recipientEmail: "Reviewer@Example.com",
    });
    expect(review.decision.allowed).toBe(true);
    expect(review.summary?.schemaVersion).toBe("recipient_trust_review.v1");
    expect(review.summary?.access).toEqual(
      expect.objectContaining({
        authenticated: true,
        viewOnly: true,
        downloadEnabled: false,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
        automatedDecisioningEnabled: false,
      })
    );
    expect(review.summary?.includedClaims.length).toBeGreaterThan(0);
    const payload = JSON.stringify(review.summary || {});
    expect(payload).not.toContain("tenant-1");
    expect(payload).not.toContain("policyDecisions");
    expect(payload).not.toContain("rawProviderPayloadIncluded\":true");
    expect(payload).not.toContain("rawEvidenceIncluded\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("downloadEnabled\":true");
    expect(payload).not.toContain("accessTokenIssued");
  });

  it("blocks recipient review for revoked, expired, and policy-denied grants", async () => {
    const service = await import("../tenantInstitutionAccessService");

    const revokedGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "insurer",
      recipient: { email: "reviewer@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    await service.revokeTenantInstitutionAccessGrant({ tenantId: "tenant-1", grantId: revokedGrant?.grantId || "" });
    const revoked = await service.getRecipientTrustReview({
      grantId: revokedGrant?.grantId || "",
      recipientEmail: "reviewer@example.com",
    });
    expect(revoked.decision.allowed).toBe(false);
    expect(revoked.decision.status).toBe("revoked");

    const activeGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "lender",
      recipient: { email: "underwriter@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    ensureCollection("tenantInstitutionAccessGrants").set(activeGrant?.grantId || "", {
      ...ensureCollection("tenantInstitutionAccessGrants").get(activeGrant?.grantId || ""),
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    const expired = await service.getRecipientTrustReview({
      grantId: activeGrant?.grantId || "",
      recipientEmail: "underwriter@example.com",
    });
    expect(expired.decision.allowed).toBe(false);
    expect(expired.decision.status).toBe("expired");

    const blockedGrant = await service.createTenantInstitutionAccessGrant({
      tenantId: "tenant-1",
      audience: "auditor",
      recipient: { email: "auditor@example.com" },
      expiresInDays: 7,
      consentAccepted: true,
    });
    ensureCollection("tenantInstitutionAccessGrants").set(blockedGrant?.grantId || "", {
      ...ensureCollection("tenantInstitutionAccessGrants").get(blockedGrant?.grantId || ""),
      package: { status: "blocked", exportSummaries: [], blockedReasons: ["test_block"] },
    });
    const blocked = await service.getRecipientTrustReview({
      grantId: blockedGrant?.grantId || "",
      recipientEmail: "auditor@example.com",
    });
    expect(blocked.decision.allowed).toBe(false);
    expect(blocked.decision.status).toBe("blocked");
  });
});
