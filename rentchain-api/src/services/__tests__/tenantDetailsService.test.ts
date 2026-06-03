import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantDocs = new Map<string, any>();
const propertyDocs = new Map<string, any>();
const unitDocs = new Map<string, any>();

vi.mock("../../firebase", () => ({
  db: {
    collection: (name: string) => {
      if (name === "properties") {
        return {
          doc: (id: string) => ({
            get: async () => ({
              id,
              exists: propertyDocs.has(id),
              data: () => propertyDocs.get(id),
            }),
          }),
          where: () => ({
            get: async () => ({ docs: [] }),
          }),
          get: async () => ({ docs: [] }),
        };
      }
      if (name !== "tenants") {
        return {
          doc: () => ({
            get: async () => ({ exists: false, data: () => null }),
          }),
          where: (field: string, _op: string, value: string) => ({
            get: async () => ({
              docs: Array.from(unitDocs.entries())
                .filter(([, data]) => data?.[field] === value)
                .map(([id, data]) => ({ id, data: () => data })),
            }),
          }),
          get: async () => ({ docs: [] }),
        };
      }
      return {
        where: (field: string, _op: string, value: string) => ({
          get: async () => ({
            forEach: (callback: (doc: any) => void) => {
              for (const [id, data] of tenantDocs.entries()) {
                if (data?.[field] === value) {
                  callback({ id, data: () => data });
                }
              }
            },
          }),
        }),
        get: async () => ({
          forEach: (callback: (doc: any) => void) => {
            for (const [id, data] of tenantDocs.entries()) {
              callback({ id, data: () => data });
            }
          },
        }),
      };
    },
  },
}));

vi.mock("../leaseNoticeWorkflowService", () => ({
  computeNoResponseState: vi.fn(),
  getLeaseNoticeByLeaseId: vi.fn(),
}));

vi.mock("../leaseCanonicalizationService", () => ({
  loadUnitsForProperty: vi.fn(async (_db: any, propertyId: string, landlordId?: string | null) =>
    Array.from(unitDocs.entries())
      .filter(([, data]) => data?.propertyId === propertyId && (!landlordId || data?.landlordId === landlordId))
      .map(([id, raw]) => ({
        id,
        landlordId: raw.landlordId ?? null,
        propertyId: raw.propertyId ?? null,
        unitNumber: raw.unitNumber ?? null,
        label: raw.label ?? raw.unitLabel ?? raw.unitNumber ?? null,
        rent: raw.rent ?? null,
        raw,
      }))
  ),
  resolveUnitReference: vi.fn((units: any[], reference: any) => {
    const target = String(reference || "").trim().toLowerCase();
    const unit = units.find((candidate) =>
      [candidate.id, candidate.unitNumber, candidate.label]
        .map((value) => String(value || "").trim().toLowerCase())
        .includes(target)
    );
    return { unit: unit || null, matchedBy: unit ? "test" : null, ambiguous: false, candidateIds: unit ? [unit.id] : [] };
  }),
  toCanonicalLeaseRecord: vi.fn(() => null),
  isCurrentLeaseStatus: vi.fn(() => false),
}));

vi.mock("../leasePartyConsolidationService", () => ({
  groupLeaseAgreementCandidates: vi.fn(() => []),
  pickAgreementWinner: vi.fn(() => null),
  pickTenantWinningAgreement: vi.fn(() => null),
}));

vi.mock("../risk/credibilityInsights", () => ({
  buildCredibilityInsights: vi.fn(() => null),
}));

vi.mock("../moveInRequirements", () => ({
  buildMoveInRequirements: vi.fn(() => null),
}));

vi.mock("../tenantMoveInReadinessService", () => ({
  buildMoveInReadinessRecord: vi.fn(() => null),
  getPersistedMoveInReadinessRecord: vi.fn(async () => null),
  listMoveInReadinessEvents: vi.fn(async () => []),
}));

vi.mock("../tenanciesService", () => ({
  buildDerivedTenancyFromTenant: vi.fn(() => null),
  listTenanciesByTenantId: vi.fn(async () => []),
}));

describe("getTenantsList", () => {
  beforeEach(() => {
    tenantDocs.clear();
    propertyDocs.clear();
    unitDocs.clear();
    tenantDocs.set("tenant-visible", {
      landlordId: "landlord-1",
      fullName: "Visible Tenant",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    tenantDocs.set("tenant-hidden", {
      landlordId: "landlord-1",
      fullName: "Hidden Tenant",
      hiddenFromActiveLists: true,
      createdAt: "2026-01-03T00:00:00.000Z",
    });
  });

  it("excludes hidden tenants from landlord active lists when requested", async () => {
    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
      excludeHiddenFromActiveLists: true,
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-visible"]);
  });

  it("preserves hidden tenants when explicit filtering is not requested", async () => {
    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual([
      "tenant-hidden",
      "tenant-visible",
    ]);
  });

  it("hides the targeted test-tenant ids even if the cleanup flag was never written", async () => {
    tenantDocs.set("c43992df00d07acae140ba76", {
      landlordId: "landlord-1",
      fullName: "test2",
      createdAt: "2026-01-04T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({
      landlordId: "landlord-1",
      excludeHiddenFromActiveLists: true,
    });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["tenant-visible"]);
  });

  it("returns persisted converted tenants without appending in-memory duplicates", async () => {
    tenantDocs.clear();
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const first = await getTenantsList({ landlordId: "landlord-1" });
    const second = await getTenantsList({ landlordId: "landlord-1" });

    expect(first.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
    expect(second.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
    expect(second.filter((tenant) => tenant.applicationId === "app-1")).toHaveLength(1);
  });

  it("dedupes persisted duplicate tenant docs and prefers the canonical converted tenant", async () => {
    tenantDocs.clear();
    tenantDocs.set("invite-fallback-tenant", {
      landlordId: "landlord-1",
      fullName: "Invite Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: "app-1",
      source: "invite",
      createdAt: "2026-01-06T00:00:00.000Z",
    });
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({ landlordId: "landlord-1" });

    expect(tenants.map((tenant) => tenant.id)).toEqual(["converted-tenant-1"]);
  });

  it("hydrates missing property name and unit label from canonical records", async () => {
    tenantDocs.clear();
    propertyDocs.set("property-1", {
      landlordId: "landlord-1",
      name: "Harbour View",
    });
    unitDocs.set("unit-1", {
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitNumber: "302",
      label: "Suite 302",
    });
    tenantDocs.set("converted-tenant-1", {
      landlordId: "landlord-1",
      fullName: "Converted Tenant",
      email: "tenant@example.com",
      propertyId: "property-1",
      unitId: "unit-1",
      unit: "unit-1",
      applicationId: "app-1",
      source: "application_conversion",
      createdAt: "2026-01-05T00:00:00.000Z",
    });

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList({ landlordId: "landlord-1" });

    expect(tenants[0]).toMatchObject({
      id: "converted-tenant-1",
      propertyName: "Harbour View",
      unit: "302",
      lifecycle: expect.objectContaining({
        lifecycleState: "active",
        lifecycleLabel: "Active",
      }),
    });
  });

  it("preserves fallback tenants when no tenant records exist outside landlord scope", async () => {
    tenantDocs.clear();

    const { getTenantsList } = await import("../tenantDetailsService");
    const tenants = await getTenantsList();

    expect(tenants.map((tenant) => tenant.id)).toEqual(["t1", "t2", "t3"]);
  });
});
