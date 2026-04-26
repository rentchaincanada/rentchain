import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
let generatedId = 0;

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

const dbMock = {
  collection: (name: string) => ({
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
};

const resolveTenancyContext = vi.fn();
const loadTenantIdentityRecord = vi.fn();

vi.mock("../../../config/firebase", () => ({ db: dbMock }));
vi.mock("../tenancyContextService", () => ({ resolveTenancyContext }));
vi.mock("../tenantProfileService", () => ({ loadTenantIdentityRecord }));

describe("tenantSharePackageService", () => {
  beforeEach(() => {
    collections.clear();
    generatedId = 0;
    vi.clearAllMocks();
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
    });
    resolveTenancyContext.mockResolvedValue({
      ok: true,
      authority: "active_tenant",
      propertyId: "prop-1",
      rc_prop_id: "rc-prop-1",
      applicationId: "app-1",
      leaseId: "lease-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      invitedEmail: "tenant@example.com",
    });
    loadTenantIdentityRecord.mockResolvedValue({
      identityStatus: "verified",
      profile: { completionStatus: "complete" },
      application: { reusable: true, lastSubmittedAt: "2026-04-20T00:00:00.000Z" },
      documents: { completionStatus: "complete", missingCategories: ["Identity"] },
      screening: { status: "completed", lastCompletedAt: "2026-04-21T00:00:00.000Z" },
      leases: { activeCount: 1, historicalCount: 2, lastSignedAt: "2026-04-22T00:00:00.000Z" },
      verification: { level: "strong" },
      readinessLabel: "Well established",
      readinessDescription: "Your rental identity includes completed verification signals and visible lease history.",
    });
  });

  it("creates share packages without persisting raw tokens and keeps tokens unique", async () => {
    const service = await import("../tenantSharePackageService");
    const createdA = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const createdB = await service.createTenantSharePackage({ tenantId: "tenant-1" });

    expect(createdA.shareUrl).not.toEqual(createdB.shareUrl);
    const docs = Array.from(ensureCollection("tenantSharePackages").values());
    expect(docs).toHaveLength(2);
    expect(docs.every((entry) => entry.tokenHash && !entry.token)).toBe(true);
    expect(docs[0]?.permissions).toEqual({
      identitySummary: true,
      credibilitySummary: false,
      applicationSummary: false,
      documents: "none",
    });
    expect(docs[0]?.requestedItems).toEqual([]);
    expect(docs[0]?.approvedItems).toEqual([]);
  });

  it("derives a safe public payload at read time with identity only by default", async () => {
    const service = await import("../tenantSharePackageService");
    const created = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const token = created.shareUrl.split("/share/")[1];

    const payload = await service.readTenantSharePackageByToken(token);

    expect(payload).toEqual(
      expect.objectContaining({
        identity: expect.objectContaining({
          identityStatus: "verified",
          verification: { level: "strong" },
        }),
        availability: expect.objectContaining({
          canRequestMore: true,
          availableSections: ["identity"],
        }),
      })
    );
    expect((payload as any)?.documents).toBeUndefined();
    expect((payload as any)?.application).toBeUndefined();
    expect((payload as any)?.credibilitySummary).toBeUndefined();
  });

  it("stores sanitized request items and applies tenant-approved expansions only", async () => {
    const service = await import("../tenantSharePackageService");
    const created = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const token = created.shareUrl.split("/share/")[1];

    const requested = await service.requestTenantSharePackageItems({
      token,
      requestedItems: ["documents_summary", "unknown_key", "credibility_summary", "documents_summary"],
    });
    expect(requested).toEqual({
      requestedItems: ["documents_summary", "credibility_summary"],
    });

    const responded = await service.respondToTenantSharePackage({
      tenantId: "tenant-1",
      sharePackageId: created.id,
      approvedItems: ["credibility_summary", "documents_summary", "application_summary"],
    });
    expect(responded).toEqual(
      expect.objectContaining({
        approvedItems: ["credibility_summary", "documents_summary"],
        requestedItems: [],
        permissions: {
          identitySummary: true,
          credibilitySummary: true,
          applicationSummary: false,
          documents: "approved_only",
        },
      })
    );

    const payload = await service.readTenantSharePackageByToken(token);
    expect(payload?.identity).toBeTruthy();
    expect(payload?.credibilitySummary).toEqual(
      expect.objectContaining({
        completenessLevel: expect.stringMatching(/low|medium|high/),
      })
    );
    expect(payload?.documents).toEqual({ completionStatus: "complete" });
    expect(payload?.application).toBeUndefined();
  });

  it("only lets the owning tenant respond to a share request", async () => {
    const service = await import("../tenantSharePackageService");
    const created = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const token = created.shareUrl.split("/share/")[1];
    await service.requestTenantSharePackageItems({
      token,
      requestedItems: ["application_summary"],
    });

    await expect(
      service.respondToTenantSharePackage({
        tenantId: "tenant-2",
        sharePackageId: created.id,
        approvedItems: ["application_summary"],
      })
    ).resolves.toBe(false);
  });

  it("returns null for revoked or expired share packages", async () => {
    const service = await import("../tenantSharePackageService");
    const created = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const token = created.shareUrl.split("/share/")[1];
    const recordId = created.id;

    await ensureCollection("tenantSharePackages").set(recordId, {
      ...ensureCollection("tenantSharePackages").get(recordId),
      status: "revoked",
    });
    expect(await service.readTenantSharePackageByToken(token)).toBeNull();

    const created2 = await service.createTenantSharePackage({ tenantId: "tenant-1" });
    const token2 = created2.shareUrl.split("/share/")[1];
    const recordId2 = created2.id;
    ensureCollection("tenantSharePackages").set(recordId2, {
      ...ensureCollection("tenantSharePackages").get(recordId2),
      expiresAt: Date.now() - 1000,
    });
    expect(await service.readTenantSharePackageByToken(token2)).toBeNull();
  });
});
