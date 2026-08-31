import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  const queries: Array<{ collection: string; field: string; operator: string; value: unknown }> = [];
  const writes: string[] = [];
  const documents: Record<string, Array<{ id: string; data: Record<string, unknown> }>> = {
    properties: [{ id: "property-1", data: { landlordId: "landlord-1", name: "Harbour House" } }],
    tenants: [{ id: "tenant-1", data: { landlordId: "landlord-1", status: "former" } }],
  };
  const db = {
    collection(name: string) {
      return {
        where(field: string, operator: string, value: unknown) {
          queries.push({ collection: name, field, operator, value });
          return {
            async get() {
              const docs = (documents[name] || []).filter(({ data }) => {
                const actual = field.split(".").reduce((current: any, part) => current?.[part], data);
                if (operator === "==") return actual === value;
                if (operator === "in") return Array.isArray(value) && value.includes(actual);
                if (operator === "array-contains-any") return Array.isArray(actual) && Array.isArray(value) && actual.some((entry) => value.includes(entry));
                return false;
              }).map((doc) => ({ id: doc.id, data: () => doc.data }));
              return { docs };
            },
          };
        },
        get() { throw new Error(`unbounded collection read: ${name}`); },
        add() { writes.push(name); },
        doc() { return { set() { writes.push(name); }, create() { writes.push(name); }, update() { writes.push(name); }, delete() { writes.push(name); } }; },
      };
    },
  };
  return { db, queries, writes };
});

vi.mock("../../firebase", () => ({ db: firestore.db }));

import { getOccupancyReviewWorkspace } from "../occupancyReviewWorkspaceService";

describe("occupancyReviewWorkspaceService query boundaries", () => {
  beforeEach(() => { firestore.queries.length = 0; firestore.writes.length = 0; });

  it("uses only landlord- or owned-context-bounded reads and performs no writes", async () => {
    const workspace = await getOccupancyReviewWorkspace("landlord-1");

    expect(workspace.items).toEqual([]);
    expect(firestore.queries.length).toBe(14);
    expect(firestore.queries).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: "properties", field: "landlordId", operator: "==", value: "landlord-1" }),
      expect.objectContaining({ collection: "units", field: "propertyId", operator: "in", value: ["property-1"] }),
      expect.objectContaining({ collection: "units", field: "currentTenantId", operator: "in", value: ["tenant-1"] }),
      expect.objectContaining({ collection: "leases", field: "tenantIds", operator: "array-contains-any", value: ["tenant-1"] }),
      expect.objectContaining({ collection: "canonicalEvents", field: "metadata.landlordRef", operator: "==" }),
    ]));
    expect(firestore.writes).toEqual([]);
  });
});
