import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, Record<string, unknown>>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

const dbMock = {
  collection: (name: string) => ({
    get: async () => ({
      docs: Array.from(ensureCollection(name).entries()).map(([id, value]) => ({
        id,
        data: () => clone(value),
      })),
    }),
  }),
};

vi.mock("../../firebase", () => ({ db: dbMock }));

const PUBLIC_RECORD_KEYS = ["audienceRole", "body", "id", "occurredAt", "priority", "readAt", "sourceKind", "status", "title"];
const EXCLUDED_RESPONSE_FIELDS = [
  "sourceId",
  "sourceRef",
  "audienceScopeKey",
  "rawIdsIncluded",
  "tokensIncluded",
  "secretsIncluded",
  "providerPayloadIncluded",
  "storagePathIncluded",
  "privateNotesIncluded",
];

describe("unified inbox service", () => {
  beforeEach(() => {
    collections.clear();
    ensureCollection("tenantNotifications").set("tenant-message-1", {
      id: "tenant-message-1",
      tenantWorkspaceId: "tenant-workspace-1",
      sourceKind: "tenant.message",
      title: "Message update",
      summary: "Your landlord replied.",
      createdAt: "2026-06-09T12:00:00.000Z",
    });
    ensureCollection("tenantNotifications").set("tenant-secret-1", {
      id: "tenant-secret-1",
      tenantWorkspaceId: "tenant-workspace-1",
      sourceKind: "tenant.message",
      title: "Unsafe",
      summary: "secret token",
      createdAt: "2026-06-09T13:00:00.000Z",
    });
    ensureCollection("viewingRequests").set("viewing-1", {
      id: "viewing-1",
      landlordId: "landlord-1",
      tenantWorkspaceId: "tenant-workspace-1",
      applicantName: "Taylor Tenant",
      status: "scheduled",
      updatedAt: "2026-06-09T14:00:00.000Z",
    });
    ensureCollection("workOrders").set("work-order-1", {
      id: "work-order-1",
      landlordId: "landlord-1",
      assignedContractorId: "contractor-1",
      title: "Sink repair",
      category: "plumbing",
      status: "assigned",
      updatedAt: "2026-06-09T11:00:00.000Z",
    });
    ensureCollection("contractorMessages").set("contractor-message-1", {
      id: "contractor-message-1",
      contractorId: "contractor-1",
      senderRole: "landlord",
      text: "Please confirm the appointment.",
      createdAt: "2026-06-09T10:00:00.000Z",
    });
  });

  it("returns tenant-scoped projected events without raw identifiers", async () => {
    const { getUnifiedInbox } = await import("../../services/unifiedInbox/unifiedInboxService");

    const result = await getUnifiedInbox(
      { role: "tenant", tenantId: "tenant-1", tenantWorkspaceId: "tenant-workspace-1" },
      { limit: "20" }
    );

    expect(result.role).toBe("tenant");
    expect(result.items.map((item) => item.audienceRole)).toEqual(["tenant", "tenant"]);
    expect(result.items.map((item) => item.sourceKind)).toEqual(["tenant.viewing", "tenant.message"]);
    expect(result.items.map((item) => Object.keys(item).sort())).toEqual([PUBLIC_RECORD_KEYS, PUBLIC_RECORD_KEYS]);
    expect(result.records).toEqual(result.items);
    const json = JSON.stringify(result.items);
    expect(json).not.toContain("tenant-workspace-1");
    expect(json).not.toContain("viewing-1");
    expect(json).not.toContain("tenant-message-1");
    expect(json).not.toContain("secret token");
    for (const field of EXCLUDED_RESPONSE_FIELDS) {
      expect(json).not.toContain(field);
    }
  });

  it("returns landlord and contractor projections for their own scopes only", async () => {
    const { getUnifiedInbox } = await import("../../services/unifiedInbox/unifiedInboxService");

    const landlordResult = await getUnifiedInbox({ role: "landlord", landlordId: "landlord-1" }, {});
    expect(landlordResult.items.map((item) => item.sourceKind)).toEqual(["landlord.viewing", "landlord.work_order"]);
    expect(landlordResult.items.map((item) => Object.keys(item).sort())).toEqual([PUBLIC_RECORD_KEYS, PUBLIC_RECORD_KEYS]);
    expect(JSON.stringify(landlordResult.items)).not.toContain("landlord-1");
    expect(JSON.stringify(landlordResult.items)).not.toContain("work-order-1");
    for (const field of EXCLUDED_RESPONSE_FIELDS) {
      expect(JSON.stringify(landlordResult.items)).not.toContain(field);
    }

    const contractorResult = await getUnifiedInbox({ role: "contractor", contractorId: "contractor-1" }, {});
    expect(contractorResult.items.map((item) => item.sourceKind)).toEqual(["contractor.work_order", "contractor.message"]);
    expect(contractorResult.items.map((item) => Object.keys(item).sort())).toEqual([PUBLIC_RECORD_KEYS, PUBLIC_RECORD_KEYS]);
    expect(JSON.stringify(contractorResult.items)).not.toContain("contractor-1");
    expect(JSON.stringify(contractorResult.items)).not.toContain("landlord-1");
    for (const field of EXCLUDED_RESPONSE_FIELDS) {
      expect(JSON.stringify(contractorResult.items)).not.toContain(field);
    }
  });

  it("fails closed on cross-scope query attempts and invalid filters", async () => {
    const { getUnifiedInbox } = await import("../../services/unifiedInbox/unifiedInboxService");

    await expect(
      getUnifiedInbox(
        { role: "tenant", tenantId: "tenant-1", tenantWorkspaceId: "tenant-workspace-1" },
        { tenantWorkspaceId: "tenant-workspace-2" }
      )
    ).rejects.toMatchObject({ status: 403, code: "TENANT_SCOPE_FORBIDDEN" });

    await expect(getUnifiedInbox({ role: "landlord", landlordId: "landlord-1" }, { source: "admin.audit" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_SOURCE",
    });
  });
});
