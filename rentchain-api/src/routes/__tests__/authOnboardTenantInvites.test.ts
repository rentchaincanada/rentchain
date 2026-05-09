import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
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
      limit: (_count: number) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => applyWhereFilter(data, field, op, value))
            .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
          return { docs, empty: docs.length === 0 };
        },
      }),
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

vi.mock("../../auth/jwt", () => ({
  signAuthToken: vi.fn(() => "auth-token"),
  verifyAuthToken: vi.fn(() => {
    throw new Error("no auth");
  }),
}));

vi.mock("../../services/tenantPortal/tenantEventLogService", () => ({
  recordTenantEvent: vi.fn(async () => ({ id: "event-1" })),
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [pathWithQuery, queryRaw = ""] = options.url.split("?");
    const query = Object.fromEntries(new URLSearchParams(queryRaw));
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: pathWithQuery,
      body: options.body ?? {},
      headers: {},
      query,
      get() {
        return undefined;
      },
      header() {
        return undefined;
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("auth onboard tenant invites", () => {
  beforeEach(() => {
    collections.clear();
    process.env.JWT_SECRET = "test-secret";
  });

  it("resolves and accepts hashed tenancy_invites tokens from tenant invite links", async () => {
    const { createTenancyInvite } = await import("../../services/tenantPortal/tenantInviteService");
    const created = await createTenancyInvite({
      landlordId: "landlord-1",
      propertyId: "property-1",
      applicationId: "app-1",
      unitId: "unit-1",
      invitedEmail: "tenant@example.com",
      invitedName: "Tenant Name",
      createdBy: "landlord-1",
    });

    const router = (await import("../authRoutes")).default;

    const resolveRes = await invokeRouter(router, {
      method: "GET",
      url: `/onboard/resolve?source=tenant&token=${created.token}`,
    });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body).toMatchObject({
      ok: true,
      inviteType: "tenant",
      status: "valid",
      email: "tenant@example.com",
      propertyId: "property-1",
    });

    const acceptRes = await invokeRouter(router, {
      method: "POST",
      url: "/onboard/accept",
      body: { source: "tenant", token: created.token },
    });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body).toMatchObject({
      ok: true,
      accepted: true,
      role: "tenant",
      redirectTo: "/tenant",
      propertyId: "property-1",
    });
    expect(acceptRes.body?.tenantToken).toBeTruthy();

    const storedInvite = ensureCollection("tenancy_invites").get(created.invite.id);
    expect(storedInvite?.status).toBe("redeemed");
    expect(storedInvite?.token).toBeUndefined();
  });

  it("reports replaced tenancy_invites tokens as expired instead of not found", async () => {
    const { createReplacementTenancyInvite } = await import("../../services/tenantPortal/tenantInviteService");
    const first = await createReplacementTenancyInvite({
      landlordId: "landlord-2",
      propertyId: "property-2",
      applicationId: "app-2",
      unitId: "unit-2",
      invitedEmail: "tenant2@example.com",
      createdBy: "landlord-2",
    });
    await createReplacementTenancyInvite({
      landlordId: "landlord-2",
      propertyId: "property-2",
      applicationId: "app-2",
      unitId: "unit-2",
      invitedEmail: "tenant2@example.com",
      createdBy: "landlord-2",
    });

    const router = (await import("../authRoutes")).default;

    const resolveRes = await invokeRouter(router, {
      method: "GET",
      url: `/onboard/resolve?source=tenant&token=${first.token}`,
    });
    expect(resolveRes.status).toBe(410);
    expect(resolveRes.body).toMatchObject({
      ok: false,
      inviteType: "tenant",
      status: "expired",
    });
  });
});
