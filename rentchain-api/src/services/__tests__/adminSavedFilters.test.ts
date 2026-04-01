import { beforeEach, describe, expect, it } from "vitest";
import {
  createAdminSavedFilter,
  deleteAdminSavedFilter,
  listAdminSavedFilters,
  sanitizeSavedFilterPayload,
} from "../admin/adminSavedFilters";

type StoredDoc = { id: string; data: Record<string, unknown> };

function createFirestoreMock() {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    collection(name: string) {
      const col = ensure(name);
      return {
        where(field: string, _op: string, value: unknown) {
          return {
            async get() {
              const docs = [...col.values()]
                .filter((doc) => doc.data[field] === value)
                .map((doc) => ({ id: doc.id, data: () => doc.data }));
              return { docs };
            },
          };
        },
        doc(id?: string) {
          const docId = id || `auto_${++autoId}`;
          return {
            id: docId,
            async set(data: Record<string, unknown>) {
              col.set(docId, { id: docId, data });
            },
            async get() {
              const item = col.get(docId);
              return {
                exists: Boolean(item),
                data: () => item?.data,
              };
            },
            async delete() {
              col.delete(docId);
            },
          };
        },
      };
    },
  };
}

describe("adminSavedFilters", () => {
  let firestore: ReturnType<typeof createFirestoreMock>;

  beforeEach(() => {
    firestore = createFirestoreMock();
  });

  it("creates, lists, and deletes user-scoped presets", async () => {
    const created = await createAdminSavedFilter({
      firestore: firestore as any,
      userId: "admin-1",
      pageKey: "leases",
      name: "Active leases",
      filters: { q: "Coburg", status: "active", sortBy: "updatedAt" },
    });

    const items = await listAdminSavedFilters({
      firestore: firestore as any,
      userId: "admin-1",
      pageKey: "leases",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: created.id,
      name: "Active leases",
      filters: { q: "Coburg", status: "active", sortBy: "updatedAt" },
    });

    await deleteAdminSavedFilter({
      firestore: firestore as any,
      userId: "admin-1",
      id: created.id,
    });

    const afterDelete = await listAdminSavedFilters({
      firestore: firestore as any,
      userId: "admin-1",
      pageKey: "leases",
    });
    expect(afterDelete).toHaveLength(0);
  });

  it("rejects invalid page keys and strips transient pagination keys from payloads", () => {
    expect(() => sanitizeSavedFilterPayload("leases", { q: "Main", page: 2, pageSize: 50, status: "active" })).not.toThrow();
    expect(sanitizeSavedFilterPayload("leases", { q: "Main", page: 2, pageSize: 50, status: "active" })).toEqual({
      q: "Main",
      status: "active",
    });
  });

  it("prevents deleting another admin's preset", async () => {
    const created = await createAdminSavedFilter({
      firestore: firestore as any,
      userId: "admin-1",
      pageKey: "properties",
      name: "NS issues",
      filters: { province: "NS", integrity: "issues" },
    });

    await expect(
      deleteAdminSavedFilter({
        firestore: firestore as any,
        userId: "admin-2",
        id: created.id,
      })
    ).rejects.toThrow("preset not found");
  });
});
