import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function applyWhereFilter(data: any, field: string, op: string, value: any) {
  if (op === "==") return data?.[field] === value;
  return false;
}

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => ({
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => applyWhereFilter(data, field, op, value))
          .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
        return { docs, empty: docs.length === 0 };
      },
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

describe("tenantInviteService", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("stores only the token hash on invite creation", async () => {
    const { createTenancyInvite } = await import("../tenantPortal/tenantInviteService");
    const created = await createTenancyInvite({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicationId: "app-1",
      invitedEmail: "tenant@example.com",
      createdBy: "landlord-1",
    });

    const doc = ensureCollection("tenancy_invites").get(created.invite.id);
    expect(created.token).toBeTruthy();
    expect(doc?.token_hash).toBeTruthy();
    expect(doc?.token).toBeUndefined();
    expect(doc?.invited_email).toBe("tenant@example.com");
  });

  it("redeems an invite exactly once", async () => {
    const { createTenancyInvite, redeemTenancyInvite } = await import("../tenantPortal/tenantInviteService");
    const created = await createTenancyInvite({
      landlordId: "landlord-2",
      propertyId: "prop-2",
      invitedEmail: "tenant2@example.com",
      createdBy: "landlord-2",
    });

    const first = await redeemTenancyInvite({
      token: created.token,
      redeemedByUid: "user-2",
      redeemedByEmail: "tenant2@example.com",
    });
    const second = await redeemTenancyInvite({
      token: created.token,
      redeemedByUid: "user-2",
      redeemedByEmail: "tenant2@example.com",
    });

    expect(first.ok).toBe(true);
    expect(first.invite?.status).toBe("redeemed");
    expect(second.ok).toBe(false);
    expect(second.error).toBe("invite_used");
  });

  it("rejects expired invites", async () => {
    const { createTenancyInvite, redeemTenancyInvite } = await import("../tenantPortal/tenantInviteService");
    const created = await createTenancyInvite({
      landlordId: "landlord-3",
      propertyId: "prop-3",
      invitedEmail: "tenant3@example.com",
      createdBy: "landlord-3",
      expiresAt: Date.now() - 1_000,
    });

    const result = await redeemTenancyInvite({
      token: created.token,
      redeemedByUid: "user-3",
      redeemedByEmail: "tenant3@example.com",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invite_expired");
  });
});
