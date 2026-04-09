import { beforeEach, describe, expect, it, vi } from "vitest";

const units = new Map<string, any>();
const invites = new Map<string, any>();

const dbMock = {
  collection: (name: string) => {
    if (name === "units") {
      return {
        doc: (id: string) => ({
          get: async () => ({
            exists: units.has(id),
            data: () => units.get(id),
          }),
          set: async (value: any, opts?: { merge?: boolean }) => {
            const prev = units.get(id) || {};
            units.set(id, opts?.merge ? { ...prev, ...value } : value);
          },
        }),
      };
    }
    if (name === "tenancy_invites") {
      return {
        doc: (id: string) => ({
          set: async (value: any) => {
            invites.set(id, value);
          },
          get: async () => ({
            exists: invites.has(id),
            data: () => invites.get(id),
            id,
          }),
        }),
        where: (field: string, op: string, value: any) => ({
          get: async () => {
            const docs = Array.from(invites.entries())
              .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
              .map(([docId, data]) => ({ id: docId, data: () => data, exists: true }));
            return { docs, empty: docs.length === 0 };
          },
        }),
      };
    }
    if (name === "event_log") {
      return {
        doc: () => ({
          set: async () => undefined,
        }),
      };
    }
    throw new Error(`Unexpected collection: ${name}`);
  },
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
      email: "owner@example.com",
    };
    next();
  },
}));

vi.mock("../../middleware/requireLandlordOrAdmin", () => ({
  requireLandlordOrAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitTenantInvitesUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true, plan: "starter" })),
}));

vi.mock("../../services/tenantPortal/tenantEventLogService", () => ({
  recordTenantEvent: vi.fn(async () => ({ id: "event-1" })),
}));

describe("POST /api/tenant-invites", () => {
  async function invokeRouter(router: any, options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }) {
    return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
      const headers: Record<string, any> = {};
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: options.url,
        body: options.body ?? {},
        headers: options.headers ?? {},
      };
      const res: any = {
        statusCode: 200,
        setHeader: (key: string, value: any) => {
          headers[key.toLowerCase()] = value;
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload, headers });
          return this;
        },
        send(payload: any) {
          resolve({ status: this.statusCode, body: payload, headers });
          return this;
        },
      };

      router.handle(req, res, (error: any) => {
        if (error) reject(error);
      });
    });
  }

  beforeEach(() => {
    units.clear();
    invites.clear();
    units.set("unit-1", {
      id: "unit-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      occupancyStatus: "vacant",
      status: "vacant",
    });
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.SENDGRID_FROM;
    delete process.env.FROM_EMAIL;
  });

  it("creates invite for a unit with no lease and returns inviteUrl", async () => {
    const router = (await import("../tenantInvitesRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/",
      body: {
      tenantEmail: "tenant@example.com",
      tenantName: "Tenant Name",
      propertyId: "property-1",
      unitId: "unit-1",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(String(res.body?.inviteUrl || "")).toContain("/tenant/invite/");
    expect(res.body?.error).toBeUndefined();
    expect(invites.size).toBe(1);
  }, 30000);
});
