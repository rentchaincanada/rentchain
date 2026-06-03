import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";

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

vi.mock("../../../firebase", () => ({ db: dbMock }));
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
      profile: {
        completionStatus: "complete",
        sin: "999-888-777",
        bankAccountNumber: "111122223333",
        rawPayload: "raw identity payload",
      },
      application: { reusable: true, lastSubmittedAt: "2026-04-20T00:00:00.000Z" },
      documents: { completionStatus: "complete", missingCategories: [] },
      screening: {
        status: "completed",
        lastCompletedAt: "2026-04-21T00:00:00.000Z",
        providerPayload: { rawReport: "raw screening report" },
      },
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
    expectNoRestrictedProjectionFields(preview);
    expectPayloadDoesNotContainValues(preview, [
      "tenant@example.com",
      "999-888-777",
      "111122223333",
      "raw identity payload",
      "raw screening report",
    ]);
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
    expect(prepared?.lifecycleControl).toEqual(
      expect.objectContaining({
        schemaVersion: "trust_export_lifecycle_control.v1",
        state: "prepared",
        reason: "export_active",
        active: true,
        shareable: true,
        metadataOnly: true,
        publicAccessEnabled: false,
        downloadEnabled: false,
      })
    );
    expect(prepared?.lifecycleEvents?.[0]).toEqual(
      expect.objectContaining({
        eventType: "trust_export_prepared",
        reason: "export_active",
        metadataOnly: true,
      })
    );
    expect(prepared?.downloadEnabled).toBe(true);
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
    expectNoRestrictedProjectionFields(prepared);
    expectPayloadDoesNotContainValues(prepared, [
      "tenant@example.com",
      "999-888-777",
      "111122223333",
      "raw identity payload",
      "raw screening report",
    ]);
    expect(ensureCollection("tenantTrustExports").size).toBe(1);
    expect(Array.from(ensureCollection("tenantTrustExports").values())[0]?.tenantId).toBe("tenant-1");
  });

  it("supersedes older active exports when a tenant prepares a replacement for the same audience and purpose", async () => {
    const service = await import("../tenantTrustExportService");

    const first = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "insurer",
      consentAccepted: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "insurer",
      consentAccepted: true,
    });

    expect(first?.exportId).toBeTruthy();
    expect(second?.exportId).toBeTruthy();
    expect(second?.exportId).not.toBe(first?.exportId);

    const listed = await service.listTenantTrustExports({ tenantId: "tenant-1" });
    const oldExport = listed.find((item) => item.exportId === first?.exportId);
    const replacement = listed.find((item) => item.exportId === second?.exportId);
    expect(oldExport?.lifecycle).toBe("superseded");
    expect(oldExport?.lifecycleControl).toEqual(
      expect.objectContaining({
        state: "superseded",
        reason: "export_superseded",
        active: false,
        shareable: false,
        supersededByExportId: second?.exportId,
        replacedByExportId: second?.exportId,
      })
    );
    expect(oldExport?.downloadEnabled).toBe(false);
    expect(oldExport?.lifecycleEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["trust_export_superseded", "trust_export_replaced"])
    );
    expect(replacement?.lifecycle).toBe("prepared");
  });

  it("invalidates stored exports when source summaries expire, revoke, supersede, or require reverification", async () => {
    const service = await import("../tenantTrustExportService");

    const prepared = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "tenant_portability",
      consentAccepted: true,
    });
    const stored = ensureCollection("tenantTrustExports").get(prepared?.exportId || "");
    ensureCollection("tenantTrustExports").set(prepared?.exportId || "", {
      ...stored,
      package: {
        ...stored.package,
        exportSummaries: [
          {
            ...stored.package.exportSummaries[0],
            status: "revoked",
            revokedAt: "2026-05-10T00:00:00.000Z",
          },
        ],
      },
    });

    const listed = await service.listTenantTrustExports({ tenantId: "tenant-1" });
    expect(listed[0]?.lifecycle).toBe("invalidated");
    expect(listed[0]?.lifecycleControl).toEqual(
      expect.objectContaining({
        state: "invalidated",
        reason: "source_attestation_revoked",
        active: false,
        shareable: false,
      })
    );
    expect(listed[0]?.lifecycleEvents.map((event) => event.eventType)).toContain("trust_export_invalidation_detected");
    expect(JSON.stringify(listed[0])).not.toContain("supportMetadataIncluded\":true");
    expect(JSON.stringify(listed[0])).not.toContain("rawProviderPayloadIncluded\":true");
  });

  it("keeps archived exports audit-visible but inactive and non-shareable", async () => {
    const service = await import("../tenantTrustExportService");

    const prepared = await service.prepareTenantTrustExport({
      tenantId: "tenant-1",
      audience: "auditor",
      consentAccepted: true,
    });
    const archived = await service.archiveTenantTrustExport({
      tenantId: "tenant-1",
      exportId: prepared?.exportId || "",
    });

    expect(archived && archived.lifecycle).toBe("archived");
    expect(archived && archived.downloadEnabled).toBe(false);
    expect(archived && archived.lifecycleControl).toEqual(
      expect.objectContaining({
        state: "archived",
        reason: "export_archived",
        active: false,
        shareable: false,
      })
    );
    const listed = await service.listTenantTrustExports({ tenantId: "tenant-1" });
    expect(listed[0]?.lifecycle).toBe("archived");
    expect(listed[0]?.lifecycleEvents.map((event) => event.eventType)).toContain("trust_export_archived");
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
