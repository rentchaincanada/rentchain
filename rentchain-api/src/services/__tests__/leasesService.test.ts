import { beforeEach, describe, expect, it, vi } from "vitest";

type LeaseDoc = Record<string, any>;

const store = new Map<string, LeaseDoc>();

const dbMock = {
  collection: (_name: string) => ({
    doc: (id: string) => ({
      set: async (value: any, options?: { merge?: boolean }) => {
        if (options?.merge && store.has(id)) {
          const existing = store.get(id) || {};
          store.set(id, { ...existing, ...value });
          return;
        }
        store.set(id, value);
      },
      get: async () => ({
        exists: store.has(id),
        data: () => store.get(id),
      }),
    }),
    where: (_field: string, _op: string, value: string) => ({
      get: async () => ({
        docs: Array.from(store.entries())
          .filter(([, doc]) => String(doc.tenantId || "") === value)
          .map(([docId, doc]) => ({
            id: docId,
            data: () => doc,
          })),
      }),
    }),
  }),
};

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

vi.mock("uuid", () => ({
  v4: () => "lease-fixed-id",
}));

describe("leasesService", () => {
  beforeEach(() => {
    store.clear();
  });

  it("applies lifecycle defaults when creating a lease record", async () => {
    const { createLease } = await import("../leasesService");
    const lease = await createLease({
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      startDate: "2026-03-01",
      endDate: null,
      rent: 180000,
    });

    expect(lease.id).toBe("lease-fixed-id");
    expect(lease.automationEnabled).toBe(true);
    expect(lease.renewalStatus).toBe("unknown");
  });

  it("updates lease lifecycle fields in DB layer", async () => {
    const { createLease, updateLeaseLifecycle } = await import("../leasesService");
    await createLease({
      tenantId: "tenant-2",
      propertyId: "property-2",
      unitId: "unit-2",
      startDate: "2026-01-01",
      endDate: null,
      rent: 200000,
    });

    const updated = await updateLeaseLifecycle("lease-fixed-id", {
      automationEnabled: false,
      renewalStatus: "offered",
      endDate: "2026-12-31",
    });

    expect(updated).toBeTruthy();
    expect(updated?.automationEnabled).toBe(false);
    expect(updated?.renewalStatus).toBe("offered");
    expect(updated?.endDate).toBe("2026-12-31");
  });
});
