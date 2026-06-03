import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function buildQueryDocs(name: string, filters: Array<{ field: string; op: string; value: any }>) {
  const docs = Array.from(ensureCollection(name).entries())
    .filter(([, data]) =>
      filters.every((filter) => {
        const target = data?.[filter.field];
        if (filter.op === "==") return target === filter.value;
        if (filter.op === "array-contains") return Array.isArray(target) && target.includes(filter.value);
        return false;
      })
    )
    .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
  return docs;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => ({
      get: async () => {
        const docs = buildQueryDocs(name, [{ field, op, value }]);
        return { docs, empty: docs.length === 0 };
      },
    }),
  }),
};

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

describe("resolveTenancyContext", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("resolves applicant linkage from application email", async () => {
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      propertyId: "prop-1",
      unitApplied: "4A",
      status: "submitted",
    });
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "user-1",
      email: "tenant@example.com",
      tenantId: null,
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.authority).toBe("applicant");
    expect(result.propertyId).toBe("prop-1");
    expect(result.applicationId).toBe("app-1");
    expect(result.rc_prop_id).toBe("rc-prop-1");
  });

  it("resolves active tenant linkage from lease context", async () => {
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-2",
      unitId: "unit-9",
      status: "active",
    });
    ensureCollection("properties").set("prop-2", {
      rc_prop_id: "rc-prop-2",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "user-2",
      email: "leaseholder@example.com",
      tenantId: "tenant-1",
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.authority).toBe("active_tenant");
    expect(result.leaseId).toBe("lease-1");
    expect(result.unitId).toBe("unit-9");
  });

  it("resolves workspace authority from the tenant record and currentLeaseId when leaseId is null", async () => {
    ensureCollection("tenants").set("bcea70bf3f353746c8895bc9", {
      tenantId: "bcea70bf3f353746c8895bc9",
      email: "hello+tenant1@rentchain.ai",
      landlordId: "PXbRIbJdZpV2eBjzNmLaISgDa852",
      propertyId: "mAdeNtAtzAOrxGA4Dx9H",
      unitId: "ufSsrCIiWSOHPCDtUAS5",
      currentLeaseId: "HMqzstV4BcZszl9dgPGP",
      leaseId: null,
      source: "invite",
    });
    ensureCollection("leases").set("HMqzstV4BcZszl9dgPGP", {
      tenantId: "bcea70bf3f353746c8895bc9",
      propertyId: "mAdeNtAtzAOrxGA4Dx9H",
      unitId: "ufSsrCIiWSOHPCDtUAS5",
      status: "active",
    });
    ensureCollection("properties").set("mAdeNtAtzAOrxGA4Dx9H", {
      rc_prop_id: "rc-prop-tenant-1",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "bcea70bf3f353746c8895bc9",
      email: "hello+tenant1@rentchain.ai",
      tenantId: "bcea70bf3f353746c8895bc9",
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.authority).toBe("active_tenant");
    expect(result.propertyId).toBe("mAdeNtAtzAOrxGA4Dx9H");
    expect(result.leaseId).toBe("HMqzstV4BcZszl9dgPGP");
    expect(result.unitId).toBe("ufSsrCIiWSOHPCDtUAS5");
    expect(result.tenantId).toBe("bcea70bf3f353746c8895bc9");
  });

  it("falls back to exact tenant email match only when the authenticated email matches the existing tenant record", async () => {
    ensureCollection("tenants").set("tenant-by-email", {
      tenantId: "tenant-by-email",
      email: "tenant@example.com",
      propertyId: "prop-email",
      unitId: "unit-email",
      currentLeaseId: "lease-email",
    });
    ensureCollection("leases").set("lease-email", {
      tenantId: "tenant-by-email",
      propertyId: "prop-email",
      unitId: "unit-email",
      status: "active",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "auth-user-1",
      email: "tenant@example.com",
      tenantId: null,
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.authority).toBe("active_tenant");
    expect(result.tenantId).toBe("tenant-by-email");
    expect(result.leaseId).toBe("lease-email");
  });

  it("resolves active tenant authority from an email-linked active lease when tenant id linkage is missing", async () => {
    ensureCollection("tenants").set("tenant-by-email", {
      tenantId: "tenant-by-email",
      email: "tenant@example.com",
    });
    ensureCollection("leases").set("lease-email-only", {
      tenantEmail: "tenant@example.com",
      propertyId: "prop-email",
      unitId: "unit-6",
      status: "active",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "auth-user-1",
      email: "tenant@example.com",
      tenantId: null,
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.authority).toBe("active_tenant");
    expect(result.tenantId).toBe("tenant-by-email");
    expect(result.leaseId).toBe("lease-email-only");
    expect(result.unitId).toBe("unit-6");
  });

  it("does not grant tenant authority from an arbitrary mismatched email", async () => {
    ensureCollection("tenants").set("tenant-by-email", {
      tenantId: "tenant-by-email",
      email: "tenant@example.com",
      propertyId: "prop-email",
      unitId: "unit-email",
      currentLeaseId: "lease-email",
    });
    ensureCollection("leases").set("lease-email", {
      tenantId: "tenant-by-email",
      propertyId: "prop-email",
      unitId: "unit-email",
      status: "active",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "auth-user-2",
      email: "other@example.com",
      tenantId: null,
      leaseId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_authority");
  });

  it("resolves a tenant record when the tenantId claim matches the tenantId field even if doc id differs", async () => {
    ensureCollection("tenants").set("doc-1", {
      tenantId: "tenant-claim-1",
      email: "tenant-claim@example.com",
      propertyId: "prop-claim",
      unitId: "unit-claim",
      currentLeaseId: "lease-claim",
    });
    ensureCollection("leases").set("lease-claim", {
      tenantId: "tenant-claim-1",
      propertyId: "prop-claim",
      unitId: "unit-claim",
      status: "active",
    });

    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "tenant-claim-1",
      email: "tenant-claim@example.com",
      tenantId: "tenant-claim-1",
      leaseId: null,
    });

    expect(result.ok).toBe(true);
    expect(result.tenantId).toBe("tenant-claim-1");
    expect(result.leaseId).toBe("lease-claim");
  });

  it("fails closed when no authority exists", async () => {
    const { resolveTenancyContext } = await import("../tenantPortal/tenancyContextService");
    const result = await resolveTenancyContext({
      uid: "user-3",
      email: "nobody@example.com",
      tenantId: null,
      leaseId: null,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_authority");
  });
});
