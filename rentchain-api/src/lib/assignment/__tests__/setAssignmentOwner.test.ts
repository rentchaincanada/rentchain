import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          async get() {
            return {
              id,
              exists: ensureCollection(name).has(id),
              data: () => ensureCollection(name).get(id),
            };
          },
          async set(value: any) {
            ensureCollection(name).set(id, value);
          },
        }),
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs };
        },
      }),
    },
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

describe("setAssignmentOwner", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates a resource-scoped assignment record", async () => {
    const { setAssignmentOwner } = await import("../setAssignmentOwner");
    const record = await setAssignmentOwner({
      resourceType: "application",
      resourceId: "app-1",
      ownerId: "admin-1",
      ownerLabel: "Alex Admin",
      note: "Taking ownership",
    });

    expect(record.resource).toEqual({ type: "application", id: "app-1" });
    expect(record.currentOwner).toEqual({ ownerId: "admin-1", ownerLabel: "Alex Admin" });
    expect(record.history).toHaveLength(1);
    expect(record.history[0]).toEqual(expect.objectContaining({ action: "set", toOwnerId: "admin-1" }));
  });

  it("upserts by resource identity and appends change history", async () => {
    const { setAssignmentOwner } = await import("../setAssignmentOwner");
    await setAssignmentOwner({
      resourceType: "application",
      resourceId: "app-1",
      ownerId: "admin-1",
      ownerLabel: "Alex Admin",
    });

    const updated = await setAssignmentOwner({
      resourceType: "application",
      resourceId: "app-1",
      ownerId: "admin-2",
      ownerLabel: "Jordan Admin",
    });

    expect(updated.currentOwner).toEqual({ ownerId: "admin-2", ownerLabel: "Jordan Admin" });
    expect(updated.history).toHaveLength(2);
    expect(updated.history[1]).toEqual(
      expect.objectContaining({
        action: "changed",
        fromOwnerId: "admin-1",
        toOwnerId: "admin-2",
      })
    );
  });

  it("clears ownership and preserves append-only history", async () => {
    const { setAssignmentOwner } = await import("../setAssignmentOwner");
    await setAssignmentOwner({
      resourceType: "maintenance",
      resourceId: "maint-1",
      ownerId: "admin-1",
      ownerLabel: "Alex Admin",
    });

    const cleared = await setAssignmentOwner({
      resourceType: "maintenance",
      resourceId: "maint-1",
      ownerId: null,
      ownerLabel: null,
      note: "Returning to unassigned",
    });

    expect(cleared.currentOwner).toEqual({ ownerId: null, ownerLabel: null });
    expect(cleared.history).toHaveLength(2);
    expect(cleared.history[1]).toEqual(expect.objectContaining({ action: "cleared", fromOwnerId: "admin-1" }));
  });
});
