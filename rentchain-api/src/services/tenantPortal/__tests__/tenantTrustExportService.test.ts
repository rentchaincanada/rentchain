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

describe("tenantTrustExportService", () => {
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

  it("blocks preview export summaries until explicit tenant consent is present", async () => {
    const service = await import("../tenantTrustExportService");

    const preview = await service.previewTenantTrustExport({
      tenantId: "tenant-1",
      audience: "tenant_portability",
      consentAccepted: false,
    });

    expect(preview?.lifecycle).toBe("consent_required");
    expect(preview?.consent.granted).toBe(false);
    expect(preview?.includedClaims).toEqual([]);
    expect(preview?.excludedClaims.length).toBeGreaterThan(0);
    expect(JSON.stringify(preview)).not.toContain("documentUrl");
    expect(JSON.stringify(preview)).not.toContain("paymentMethod");
    expect(preview?.publicAccessEnabled).toBe(false);
    expect(preview?.externalSubmissionEnabled).toBe(false);
  });

  it("prepares a consent-scoped metadata-only trust export without public exposure", async () => {
    const service = await import("../tenantTrustExportService");

    const prepared = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "tenant_portability",
      consentAccepted: true,
    });

    expect(prepared?.lifecycle).toBe("prepared");
    expect(prepared?.consent.granted).toBe(true);
    expect(prepared?.package.status).toBe("export_ready");
    expect(prepared?.includedClaims.map((claim) => claim.claimCategory)).toEqual(
      expect.arrayContaining(["identity_assurance", "tenant_portability", "lease_participation", "payment_readiness"])
    );
    expect(prepared?.package.auditMetadata).toEqual(
      expect.objectContaining({
        consentScoped: true,
        policyGated: true,
        manualOnly: true,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    const payload = JSON.stringify(prepared || {});
    expect(payload).not.toContain("rawProviderPayloadIncluded\":true");
    expect(payload).not.toContain("supportMetadataIncluded\":true");
    expect(payload).not.toContain("publicAccessEnabled\":true");
    expect(payload).not.toContain("externalSubmissionEnabled\":true");
    expect(payload).not.toContain("tenant-1");
    expect(ensureCollection("tenantTrustExports").size).toBe(1);
    expect(Array.from(ensureCollection("tenantTrustExports").values())[0]?.tenantId).toBe("tenant-1");
  });

  it("requires consent before preparation and lets the owning tenant revoke the record", async () => {
    const service = await import("../tenantTrustExportService");

    await expect(
      service.prepareTenantTrustExport({
        tenantId: "tenant-1",
        audience: "insurer",
        consentAccepted: false,
      })
    ).rejects.toThrow("tenant_trust_export_consent_required");

    const prepared = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "insurer",
      consentAccepted: true,
    });
    const blocked = await service.revokeTenantTrustExport({
      tenantId: "tenant-2",
      exportId: prepared?.exportId || "",
    });
    expect(blocked).toBe(false);

    const revoked = await service.revokeTenantTrustExport({
      tenantId: "tenant-1",
      exportId: prepared?.exportId || "",
    });
    expect(revoked && revoked.lifecycle).toBe("revoked");
    expect(revoked && revoked.consent.granted).toBe(false);
    expect(revoked && revoked.consent.revokedAt).toBeTruthy();
  });
});
