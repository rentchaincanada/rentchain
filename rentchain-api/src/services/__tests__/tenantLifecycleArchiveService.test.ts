import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, seed, read, list, reset } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let sequence = 0;
  const collection = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const values = store.get(name)!;
    const doc = (id = `generated-${++sequence}`) => ({
      id,
      get: async () => ({ exists: values.has(id), id, data: () => values.get(id) }),
      set: async (value: any, options?: any) => values.set(id, options?.merge ? { ...(values.get(id) || {}), ...value } : value),
    });
    const query = (filters: Array<[string, string, any]>) => ({
      get: async () => ({
        docs: Array.from(values.entries())
          .filter(([, value]) => filters.every(([field, op, expected]) => op === "==" && value[field] === expected))
          .map(([id, value]) => ({ id, data: () => value })),
      }),
    });
    return { doc, where: (field: string, op: string, value: any) => query([[field, op, value]]) };
  };
  return {
    fakeDb: {
      collection,
      runTransaction: async (handler: any) => handler({
        get: (target: any) => target.get(),
        set: (ref: any, value: any, options?: any) => ref.set(value, options),
        create: (ref: any, value: any) => ref.set(value),
      }),
    },
    seed: (name: string, id: string, value: any) => {
      if (!store.has(name)) store.set(name, new Map());
      store.get(name)!.set(id, value);
    },
    read: (name: string, id: string) => store.get(name)?.get(id),
    list: (name: string) => Array.from(store.get(name)?.values() || []),
    reset: () => { store.clear(); sequence = 0; },
  };
});

vi.mock("../../firebase", () => ({
  db: fakeDb,
  FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" },
}));

import { mutateTenantArchiveState, TenantArchiveCommandError } from "../tenantLifecycleArchiveService";

describe("tenantLifecycleArchiveService", () => {
  beforeEach(() => {
    reset();
  });

  it("archives and restores a past tenant atomically while retaining history", async () => {
    seed("tenants", "tenant-past", { landlordId: "landlord-1", status: "Past", relationshipStatus: "past", currentLeaseId: null });
    seed("leases", "lease-ended", { landlordId: "landlord-1", tenantId: "tenant-past", status: "ended", endedAt: "2026-08-20T00:00:00.000Z" });
    seed("payments", "payment-1", { tenantId: "tenant-past", amount: 100 });

    await mutateTenantArchiveState({ tenantId: "tenant-past", landlordId: "landlord-1", actorUserId: "landlord-1", actorRole: "landlord", command: "archive" });
    expect(read("tenants", "tenant-past").archivedAt).toEqual(expect.any(String));
    expect(read("leases", "lease-ended").status).toBe("ended");
    expect(read("payments", "payment-1").amount).toBe(100);
    expect(list("canonicalEvents")).toEqual(expect.arrayContaining([expect.objectContaining({ action: "tenant_archived", appendOnly: true })]));

    await mutateTenantArchiveState({ tenantId: "tenant-past", landlordId: "landlord-1", actorUserId: "landlord-1", actorRole: "landlord", command: "restore" });
    expect(read("tenants", "tenant-past")).toMatchObject({ archivedAt: null, restoredAt: expect.any(String), status: "Past", relationshipStatus: "past" });
    expect(list("canonicalEvents").map((event: any) => event.action)).toEqual(expect.arrayContaining(["tenant_archived", "tenant_restored"]));
  });

  it("rejects archive when a canonical current lease exists", async () => {
    seed("tenants", "tenant-current", { landlordId: "landlord-1", status: "current", currentLeaseId: "lease-current" });
    seed("leases", "lease-current", { landlordId: "landlord-1", tenantId: "tenant-current", status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31" });
    await expect(mutateTenantArchiveState({ tenantId: "tenant-current", landlordId: "landlord-1", actorRole: "landlord", command: "archive" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_archive_current_relationship", status: 409 });
    expect(read("tenants", "tenant-current").archivedAt).toBeUndefined();
  });

  it("rejects archive for multiple-current conflict without resolving it", async () => {
    seed("tenants", "tenant-conflict", { landlordId: "landlord-1", status: "past", currentLeaseId: null });
    for (const id of ["lease-a", "lease-b"]) {
      seed("leases", id, { landlordId: "landlord-1", tenantId: "tenant-conflict", status: "active", executionStatus: "fully_executed", startDate: "2026-01-01", endDate: "2026-12-31" });
    }
    await expect(mutateTenantArchiveState({ tenantId: "tenant-conflict", landlordId: "landlord-1", actorRole: "landlord", command: "archive" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_archive_occupancy_conflict", status: 409 });
    expect(read("leases", "lease-a").status).toBe("active");
    expect(read("leases", "lease-b").status).toBe("active");
  });

  it("rejects archive when an occupied unit remains linked without a current lease", async () => {
    seed("tenants", "tenant-occupied", { landlordId: "landlord-1", status: "past", currentLeaseId: null });
    seed("units", "unit-1", { landlordId: "landlord-1", tenantId: "tenant-occupied", occupancyStatus: "occupied" });
    await expect(mutateTenantArchiveState({ tenantId: "tenant-occupied", landlordId: "landlord-1", actorRole: "landlord", command: "archive" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_archive_occupancy_conflict", status: 409 });
    expect(read("tenants", "tenant-occupied").archivedAt).toBeUndefined();
  });

  it("rejects archive for an upcoming operational relationship", async () => {
    seed("tenants", "tenant-upcoming", { landlordId: "landlord-1", status: "past", currentLeaseId: null });
    seed("leases", "lease-upcoming", { landlordId: "landlord-1", tenantId: "tenant-upcoming", status: "signed", executionStatus: "fully_executed", startDate: "2099-01-01", endDate: "2099-12-31" });
    await expect(mutateTenantArchiveState({ tenantId: "tenant-upcoming", landlordId: "landlord-1", actorRole: "landlord", command: "archive" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_archive_upcoming_relationship", status: 409 });
  });

  it("rejects foreign Archive at the real service boundary with no mutation or audit", async () => {
    seed("tenants", "tenant-foreign", { landlordId: "landlord-a", status: "past", currentLeaseId: null });
    const before = { ...read("tenants", "tenant-foreign") };
    await expect(mutateTenantArchiveState({ tenantId: "tenant-foreign", landlordId: "landlord-b", actorRole: "landlord", command: "archive" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_forbidden", status: 403 });
    expect(read("tenants", "tenant-foreign")).toEqual(before);
    expect(list("canonicalEvents")).toEqual([]);
  });

  it("rejects foreign Restore at the real service boundary with no mutation or audit", async () => {
    seed("tenants", "tenant-foreign", { landlordId: "landlord-a", status: "past", currentLeaseId: null, archivedAt: "2026-08-25T00:00:00.000Z" });
    const before = { ...read("tenants", "tenant-foreign") };
    await expect(mutateTenantArchiveState({ tenantId: "tenant-foreign", landlordId: "landlord-b", actorRole: "landlord", command: "restore" }))
      .rejects.toMatchObject<TenantArchiveCommandError>({ code: "tenant_forbidden", status: 403 });
    expect(read("tenants", "tenant-foreign")).toEqual(before);
    expect(list("canonicalEvents")).toEqual([]);
  });
});
