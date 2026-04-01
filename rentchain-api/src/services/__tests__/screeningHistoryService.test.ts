import { beforeEach, describe, expect, it, vi } from "vitest";

const { collectionStore, dbMock } = vi.hoisted(() => {
  const collectionStore = new Map<string, Map<string, any>>();
  let autoId = 0;

  const ensureCollection = (name: string) => {
    if (!collectionStore.has(name)) {
      collectionStore.set(name, new Map());
    }
    return collectionStore.get(name)!;
  };

  const buildQuery = (name: string, filters: Array<{ field: string; value: any }> = [], limitValue?: number) => ({
    where(field: string, _op: string, value: any) {
      return buildQuery(name, [...filters, { field, value }], limitValue);
    },
    limit(nextLimit: number) {
      return buildQuery(name, filters, nextLimit);
    },
    async get() {
      const docs = Array.from(ensureCollection(name).entries())
        .filter(([, data]) => filters.every((filter) => data?.[filter.field] === filter.value))
        .slice(0, limitValue ?? Number.MAX_SAFE_INTEGER)
        .map(([id, data]) => ({
          id,
          exists: true,
          data: () => data,
        }));
      return { docs, exists: docs.length > 0, size: docs.length };
    },
  });

  const dbMock = {
    collection: vi.fn((name: string) => ({
      doc: (id?: string) => {
        const collection = ensureCollection(name);
        const docId = id || `auto_${++autoId}`;
        return {
          id: docId,
          get: async () => ({
            exists: collection.has(docId),
            data: () => collection.get(docId),
          }),
          set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
            const existing = collection.get(docId) || {};
            collection.set(docId, options?.merge ? { ...existing, ...payload } : payload);
          },
        };
      },
      where(field: string, _op: string, value: any) {
        return buildQuery(name, [{ field, value }]);
      },
      limit(limitValue: number) {
        return buildQuery(name, [], limitValue);
      },
    })),
  };

  return { collectionStore, dbMock };
});

const requestMocks = vi.hoisted(() => ({
  getScreeningRequestForApplication: vi.fn(),
  getScreeningRequestById: vi.fn(),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../screeningRequestService", () => ({
  getScreeningRequestForApplication: requestMocks.getScreeningRequestForApplication,
  getScreeningRequestById: requestMocks.getScreeningRequestById,
}));

import { getScreeningHistoryDetail, listScreeningHistory } from "../screening/screeningHistoryService";

describe("screeningHistoryService", () => {
  beforeEach(() => {
    collectionStore.clear();
    requestMocks.getScreeningRequestForApplication.mockReset();
    requestMocks.getScreeningRequestById.mockReset();
  });

  it("builds screening history records from durable order/result data", async () => {
    collectionStore.set(
      "rentalApplications",
      new Map([
        [
          "app_1",
          {
            landlordId: "landlord_1",
            propertyId: "prop_1",
            unitId: "unit_1",
            propertyName: "Coburg Rd",
            unit: "3A",
            status: "SUBMITTED",
            applicant: { firstName: "Jamie", lastName: "Lee" },
            screeningResultId: "result_1",
            screeningCompletedAt: 200,
            createdAt: 100,
            updatedAt: 220,
          },
        ],
      ])
    );
    collectionStore.set(
      "screeningOrders",
      new Map([
        [
          "order_1",
          {
            landlordId: "landlord_1",
            applicationId: "app_1",
            propertyId: "prop_1",
            unitId: "unit_1",
            provider: "transunion_referral",
            providerRequestId: "provider_123",
            referenceId: "REF-123",
            screeningTier: "verify_ai",
            status: "complete",
            reportBucket: "secure-bucket",
            reportObjectKey: "reports/report.pdf",
            createdAt: 150,
            updatedAt: 220,
            reportGeneratedAt: 210,
          },
        ],
      ])
    );
    collectionStore.set(
      "screeningResults",
      new Map([
        [
          "result_1",
          {
            summary: {
              overall: "pass",
              scoreBand: "B",
              flags: ["Thin file"],
              confidence: "High",
            },
            updatedAt: 205,
          },
        ],
      ])
    );
    collectionStore.set(
      "screeningEvents",
      new Map([
        [
          "event_1",
          {
            applicationId: "app_1",
            orderId: "order_1",
            landlordId: "landlord_1",
            type: "report_viewed",
            at: 225,
            meta: { actorId: "user_1" },
          },
        ],
      ])
    );

    const records = await listScreeningHistory({
      landlordId: "landlord_1",
      applicationId: "app_1",
      limit: 10,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "order_1",
      applicantName: "Jamie Lee",
      provider: "transunion",
      result: "approved",
      report: {
        status: "available",
        storageMode: "rentchain_encrypted",
      },
      audit: {
        accessCount: 1,
        lastViewedByUserId: "user_1",
      },
    });
  });

  it("falls back to a summary-only legacy request when no order exists", async () => {
    collectionStore.set(
      "rentalApplications",
      new Map([
        [
          "app_legacy",
          {
            landlordId: "landlord_1",
            propertyId: "prop_1",
            propertyName: "Legacy House",
            unit: "2",
            applicant: { firstName: "Morgan", lastName: "Ng" },
            createdAt: 100,
            updatedAt: 110,
          },
        ],
      ])
    );
    requestMocks.getScreeningRequestForApplication.mockReturnValue({
      id: "request_1",
      applicationId: "app_legacy",
      landlordId: "landlord_1",
      status: "completed",
      createdAt: "2026-03-31T10:00:00.000Z",
      completedAt: "2026-03-31T11:00:00.000Z",
      providerName: "mock",
      reportSummary: {
        headline: "Manual summary retained",
        riskBand: "review",
        highlights: ["Collections present"],
      },
    });

    const records = await listScreeningHistory({
      landlordId: "landlord_1",
      applicationId: "app_legacy",
      limit: 10,
    });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("request:request_1");
    expect(records[0].report.status).toBe("not_stored");
    expect(records[0].summary.notes).toBe("Manual summary retained");
  });

  it("returns null for a screening detail outside the landlord scope", async () => {
    collectionStore.set(
      "screeningOrders",
      new Map([
        [
          "order_forbidden",
          {
            landlordId: "other_landlord",
            applicationId: "app_1",
          },
        ],
      ])
    );

    const detail = await getScreeningHistoryDetail({
      landlordId: "landlord_1",
      screeningId: "order_forbidden",
    });

    expect(detail).toBeNull();
  });
});
