import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }

  function makeQuery(name: string, filters: Array<{ field: string; value: any }> = []) {
    return {
      where: (field: string, _op: string, value: any) => makeQuery(name, [...filters, { field, value }]),
      limit: (_count: number) => makeQuery(name, filters),
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
          .map(([id, data]) => ({ id, data: () => data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, value }]),
        limit: (_count: number) => makeQuery(name),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => ({
          id,
          get: async () => ({
            id,
            exists: ensureCollection(name).has(id),
            data: () => ensureCollection(name).get(id),
          }),
        }),
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

import {
  buildPreview,
  deriveLandlordVisibleExpiringLeases,
  deriveLeaseNoticeExecutionInputSnapshot,
  normalizeLeaseRecord,
  sanitizeLeaseRenewalOperatorInput,
} from "../leaseNoticeWorkflowService";

describe("leaseNoticeWorkflowService renewal operator inputs", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("keeps readiness partial when term fields are still unset", () => {
    const lease = normalizeLeaseRecord("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      leaseEndDate: "2026-05-10",
      renewalRentChangeMode: "no_change",
      renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      status: "active",
    });

    expect(deriveLeaseNoticeExecutionInputSnapshot(lease)).toEqual(
      expect.objectContaining({
        state: "partial",
        missingFields: ["newTermType", "newLeaseStartDate", "newLeaseEndDate"],
        input: expect.objectContaining({
          rentChangeMode: "no_change",
          responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
          newTermType: null,
        }),
      })
    );
  });

  it("promotes readiness to complete when canonical renewal inputs are fully stored on the lease", () => {
    const lease = normalizeLeaseRecord("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      leaseEndDate: "2026-05-10",
      renewalRentChangeMode: "no_change",
      renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      renewalNewTermType: "fixed_term",
      renewalNewLeaseStartDate: "2026-05-11",
      renewalNewLeaseEndDate: "2027-05-10",
      status: "active",
    });

    expect(deriveLeaseNoticeExecutionInputSnapshot(lease)).toEqual(
      expect.objectContaining({
        state: "complete",
        reason: null,
        missingFields: [],
        input: expect.objectContaining({
          rentChangeMode: "no_change",
          newTermType: "fixed_term",
          newLeaseStartDate: "2026-05-11",
          newLeaseEndDate: "2027-05-10",
        }),
      })
    );
  });

  it("rejects contradictory saved operator input payloads", () => {
    expect(
      sanitizeLeaseRenewalOperatorInput({
        rentChangeMode: "no_change",
        proposedRent: 1900,
      })
    ).toEqual({
      ok: false,
      error: "PROPOSED_RENT_NOT_ALLOWED_FOR_RENT_CHANGE_MODE",
    });
  });

  it("attaches legal document metadata to notice previews", () => {
    const lease = normalizeLeaseRecord("lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      leaseEndDate: "2026-05-10",
      status: "active",
    });

    const previewResult = buildPreview(lease, {
      rentChangeMode: "increase",
      proposedRent: 1750,
      newTermType: "fixed_term",
      newLeaseStartDate: "2026-05-11",
      newLeaseEndDate: "2027-05-10",
      responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
    });

    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;
    expect(previewResult.preview.summary).toEqual({
      title: "Lease notice preview",
      body: "Proposed rent: 1750 CAD",
    });
    expect(previewResult.preview.legalDocumentMetadata).toMatchObject({
      documentKind: "lease_notice",
      province: "NS",
      templateKey: "ns.fixed_term.renewal_offer.v1",
      version: "ns-v1",
      sensitivity: "restricted",
    });
  });

  it("builds one landlord-visible renewal dataset from end-date eligibility and preserves response buckets", async () => {
    const now = Date.UTC(2026, 3, 30, 12, 0, 0, 0);
    collections.set(
      "properties",
      new Map([
        ["prop-active", { landlordId: "landlord-1", name: "Active Property", addressLine1: "123 Main St", portfolioStatus: "active" }],
        ["prop-archived", { landlordId: "landlord-1", name: "Archived Property", portfolioStatus: "archived" }],
      ])
    );
    collections.set(
      "units",
      new Map([
        ["unit-1", { landlordId: "landlord-1", propertyId: "prop-active", unitNumber: "1", label: "Unit 1", status: "occupied" }],
        ["unit-2", { landlordId: "landlord-1", propertyId: "prop-active", unitNumber: "2", label: "Unit 2", status: "occupied" }],
        ["unit-3", { landlordId: "landlord-1", propertyId: "prop-active", unitNumber: "3", label: "Unit 3", status: "occupied" }],
        ["unit-4", { landlordId: "landlord-1", propertyId: "prop-active", unitNumber: "4", label: "Unit 4", status: "vacant" }],
        ["unit-5", { landlordId: "landlord-1", propertyId: "prop-archived", unitNumber: "5", label: "Unit 5", status: "occupied" }],
      ])
    );
    collections.set(
      "leases",
      new Map([
        ["lease-expired", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "active", leaseEndDate: "2026-04-29" }],
        ["lease-pending", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-2", status: "renewal_pending", leaseEndDate: "2026-05-29", nextNoticeDueAt: now + 5 * 24 * 60 * 60 * 1000 }],
        ["lease-no-response", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-3", status: "notice_pending", leaseEndDate: "2026-06-29", nextNoticeDueAt: now + 5 * 24 * 60 * 60 * 1000 }],
        ["lease-ending-today", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "active", leaseEndDate: "2026-04-30", currentRent: null }],
        ["lease-no-payment-setup", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "active", leaseEndDate: "2026-07-01" }],
        ["lease-vacant", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-4", status: "active", leaseEndDate: "2026-06-01" }],
        ["lease-archived-property", { landlordId: "landlord-1", propertyId: "prop-archived", unitId: "unit-5", status: "active", leaseEndDate: "2026-06-01" }],
        ["lease-ended", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "ended", leaseEndDate: "2026-06-01" }],
        ["lease-renewed", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "renewal_accepted", leaseEndDate: "2026-06-01" }],
        ["lease-move-out", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "move_out_pending", leaseEndDate: "2026-06-01" }],
        ["lease-hidden", { landlordId: "landlord-1", propertyId: "prop-active", unitId: "unit-1", status: "active", leaseEndDate: "2026-06-01", hiddenFromActiveLists: true }],
      ])
    );
    collections.set(
      "leaseNotices",
      new Map([
        ["notice-pending", { landlordId: "landlord-1", leaseId: "lease-pending", tenantResponse: "pending", createdAt: now, updatedAt: now }],
        ["notice-no-response", { landlordId: "landlord-1", leaseId: "lease-no-response", tenantResponse: "pending", responseDeadlineAt: now - 1000, createdAt: now, updatedAt: now }],
      ])
    );

    const items = await deriveLandlordVisibleExpiringLeases({
      landlordId: "landlord-1",
      withinDays: 120,
      now,
    });

    expect(items.map((item) => ({ id: item.id, bucket: item.noticeBucket }))).toEqual([
      { id: "lease-expired", bucket: "expiring" },
      { id: "lease-ending-today", bucket: "expiring" },
      { id: "lease-pending", bucket: "pending-response" },
      { id: "lease-no-response", bucket: "no-response" },
      { id: "lease-no-payment-setup", bucket: "expiring" },
    ]);
  });
});
