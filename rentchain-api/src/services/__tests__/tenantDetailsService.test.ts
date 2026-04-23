import { beforeEach, describe, expect, it, vi } from "vitest";

const tenantDocs = new Map<string, any>();

vi.mock("../../config/firebase", () => ({
  db: {
    collection: (name: string) => {
      if (name !== "tenants") {
        return {
          doc: () => ({
            get: async () => ({ exists: false, data: () => null }),
          }),
          where: () => ({
            get: async () => ({ docs: [] }),
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
  loadUnitsForProperty: vi.fn(async () => []),
  resolveUnitReference: vi.fn(() => null),
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
});
