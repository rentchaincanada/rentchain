import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const hoisted = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let transunionConnected = false;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  function applyFilters(items: StoredDoc[], filters: Array<{ field: string; op: string; value: any }>) {
    return items.filter((item) =>
      filters.every((filter) => {
        if (filter.op !== "==") return true;
        return item.data?.[filter.field] === filter.value;
      })
    );
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where(field: string, op: string, value: any) {
        return makeQuery(name, [...filters, { field, op, value }]);
      },
      limit(count: number) {
        return {
          async get() {
            const items = applyFilters(Array.from(ensureCollection(name).values()), filters).slice(0, count);
            return {
              empty: items.length === 0,
              size: items.length,
              docs: items.map((item) => ({
                id: item.id,
                data: () => clone(item.data),
              })),
            };
          },
        };
      },
      async get() {
        const items = applyFilters(Array.from(ensureCollection(name).values()), filters);
        return {
          empty: items.length === 0,
          size: items.length,
          docs: items.map((item) => ({
            id: item.id,
            data: () => clone(item.data),
          })),
        };
      },
    };
  }

  return {
    dbMock: {
      collection(name: string) {
        return {
          ...makeQuery(name),
          doc(id: string) {
            return {
              id,
              async get() {
                const entry = ensureCollection(name).get(id);
                return {
                  id,
                  exists: Boolean(entry),
                  data: () => (entry ? clone(entry.data) : undefined),
                };
              },
              async set(payload: any, options?: { merge?: boolean }) {
                const collection = ensureCollection(name);
                const existing = collection.get(id);
                if (options?.merge && existing) {
                  collection.set(id, {
                    id,
                    data: {
                      ...clone(existing.data),
                      ...clone(payload || {}),
                    },
                  });
                  return;
                }
                collection.set(id, { id, data: clone(payload || {}) });
              },
            };
          },
        };
      },
    },
    resetDb() {
      collections.clear();
      transunionConnected = false;
    },
    seedDoc(collection: string, id: string, data: any) {
      ensureCollection(collection).set(id, { id, data: clone(data) });
    },
    listDocs(collection: string) {
      return Array.from(ensureCollection(collection).values()).map((item) => clone(item.data));
    },
    setTransunionConnected(value: boolean) {
      transunionConnected = value;
    },
    getTransunionStatus() {
      return transunionConnected ? "connected" : "not_connected";
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: hoisted.dbMock,
}));

vi.mock("../integrations/transunion/transunionService", () => ({
  assertTransUnionConnectedForScreening: vi.fn(async () => {
    if (hoisted.getTransunionStatus() === "connected") return;
    const error: any = new Error("Connect your TransUnion membership before starting screening.");
    error.statusCode = 409;
    error.code = "transunion_not_connected";
    throw error;
  }),
  getTransUnionIntegrationPublic: vi.fn(async () => ({
    provider: "transunion",
    status: hoisted.getTransunionStatus(),
    version: 1,
  })),
}));

function seedApplication(overrides: Record<string, any> = {}) {
  hoisted.seedDoc("rentalApplications", "app-1", {
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    applicant: {
      firstName: "Jane",
      lastName: "Doe",
    },
    ...overrides,
  });
}

describe("screeningOpsService", () => {
  beforeEach(() => {
    hoisted.resetDb();
    seedApplication();
  });

  it("returns blocked_transunion_not_connected before a screening exists", async () => {
    const { getScreeningStatusForApplication } = await import("../screeningOps/screeningOpsService");

    const result = await getScreeningStatusForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );

    expect(result.status).toBe("blocked_transunion_not_connected");
    expect(result.actionLabel).toBe("Connect TransUnion");
  });

  it("creates a requested operation when TransUnion is connected", async () => {
    hoisted.setTransunionConnected(true);
    const { requestManualScreeningForApplication } = await import("../screeningOps/screeningOpsService");

    const result = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );

    expect(result.operation.status).toBe("requested");
    expect(result.status.status).toBe("requested");
    expect(hoisted.listDocs("screeningOperations")).toHaveLength(1);
  });

  it("does not create duplicate active requests", async () => {
    hoisted.setTransunionConnected(true);
    const { requestManualScreeningForApplication } = await import("../screeningOps/screeningOpsService");

    const first = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );
    const second = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );

    expect(second.operation.id).toBe(first.operation.id);
    expect(hoisted.listDocs("screeningOperations")).toHaveLength(1);
  });

  it("starts and completes an operation", async () => {
    hoisted.setTransunionConnected(true);
    const {
      requestManualScreeningForApplication,
      startAdminScreeningOperation,
      completeAdminScreeningOperation,
    } = await import("../screeningOps/screeningOpsService");

    const created = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );
    const started = await startAdminScreeningOperation(created.operation.id, { role: "admin", id: "admin-1" });
    const completed = await completeAdminScreeningOperation(
      created.operation.id,
      {
        resultSummary: "Manual review complete.",
        resultFlags: ["income_verified"],
        reportUrl: "https://example.com/report.pdf",
      },
      { role: "admin", id: "admin-1" }
    );

    expect(started.status).toBe("in_progress");
    expect(completed.status).toBe("completed");
    expect(completed.resultSummary).toBe("Manual review complete.");
    expect(completed.resultFlags).toEqual(["income_verified"]);
  });

  it("cancels an active operation", async () => {
    hoisted.setTransunionConnected(true);
    const {
      requestManualScreeningForApplication,
      cancelAdminScreeningOperation,
    } = await import("../screeningOps/screeningOpsService");

    const created = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );
    const cancelled = await cancelAdminScreeningOperation(
      created.operation.id,
      { cancelledReason: "Applicant withdrew consent." },
      { role: "admin", id: "admin-1" }
    );

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledReason).toBe("Applicant withdrew consent.");
  });

  it("rejects invalid transitions", async () => {
    hoisted.setTransunionConnected(true);
    const {
      requestManualScreeningForApplication,
      completeAdminScreeningOperation,
      startAdminScreeningOperation,
    } = await import("../screeningOps/screeningOpsService");

    const created = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );
    await completeAdminScreeningOperation(
      created.operation.id,
      { resultSummary: "Done." },
      { role: "admin", id: "admin-1" }
    );

    await expect(
      startAdminScreeningOperation(created.operation.id, { role: "admin", id: "admin-1" })
    ).rejects.toMatchObject({
      code: "invalid_status_transition",
    });
  });

  it("returns completed landlord status with summary", async () => {
    hoisted.setTransunionConnected(true);
    const {
      requestManualScreeningForApplication,
      completeAdminScreeningOperation,
      getScreeningStatusForApplication,
    } = await import("../screeningOps/screeningOpsService");

    const created = await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );
    await completeAdminScreeningOperation(
      created.operation.id,
      {
        resultSummary: "Clear result.",
        resultFlags: ["income_verified"],
        reportExportId: "export-1",
      },
      { role: "admin", id: "admin-1" }
    );

    const status = await getScreeningStatusForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );

    expect(status.status).toBe("completed");
    expect(status.resultSummary).toBe("Clear result.");
    expect(status.reportAvailable).toBe(true);
  });

  it("blocks non-owned landlord access", async () => {
    const { getScreeningStatusForApplication } = await import("../screeningOps/screeningOpsService");

    await expect(
      getScreeningStatusForApplication(
        { role: "landlord", id: "landlord-2", landlordId: "landlord-2" },
        "app-1"
      )
    ).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("lists operations for admins", async () => {
    hoisted.setTransunionConnected(true);
    const {
      requestManualScreeningForApplication,
      listAdminScreeningOperations,
    } = await import("../screeningOps/screeningOpsService");

    await requestManualScreeningForApplication(
      { role: "landlord", id: "landlord-1", landlordId: "landlord-1" },
      "app-1"
    );

    const operations = await listAdminScreeningOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0]?.applicationId).toBe("app-1");
  });
});
