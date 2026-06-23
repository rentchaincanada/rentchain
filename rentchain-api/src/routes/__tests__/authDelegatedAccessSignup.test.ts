import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = vi.hoisted(() => new Map<string, Map<string, any>>());
const createUserMock = vi.hoisted(() => vi.fn());

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

const dbMock = vi.hoisted(() => {
  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map<string, any>());
    return collections.get(name)!;
  }
  function copy(value: any) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }
  return {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `doc_${ensure(name).size + 1}`;
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: ensure(name).has(docId),
            data: () => copy(ensure(name).get(docId)),
          }),
          set: async (value: any, opts?: { merge?: boolean }) => {
            const current = ensure(name).get(docId) || {};
            ensure(name).set(docId, opts?.merge ? { ...current, ...copy(value) } : copy(value));
          },
          create: async (value: any) => {
            if (ensure(name).has(docId)) throw new Error("already_exists");
            ensure(name).set(docId, copy(value));
          },
        };
      },
      get: async () => ({
        docs: Array.from(ensure(name).entries()).map(([id, data]) => ({
          id,
          exists: true,
          data: () => copy(data),
        })),
      }),
      where: (field: string, op: string, value: any) => ({
        limit: (_count: number) => ({
          get: async () => {
            const docs = Array.from(ensure(name).entries())
              .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
              .map(([id, data]) => ({ id, exists: true, data: () => copy(data) }));
            return { docs, empty: docs.length === 0 };
          },
        }),
      }),
    }),
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => values,
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({
      createUser: createUserMock,
    }),
  },
}));

vi.mock("../../services/authService", () => ({
  generateJwtForLandlord: vi.fn(),
  validateLandlordCredentials: vi.fn(),
}));

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function seedDelegatedInvitation(overrides: Record<string, any> = {}) {
  const invitation = {
    invitationId: "delegated_invitation_1",
    landlordId: "owner-landlord-1",
    inviteeEmail: "delegate@example.com",
    role: "property_manager",
    propertyScope: { mode: "all_current_properties", propertyIds: [] },
    workspaceScopes: ["dashboard", "operations"],
    permissionFlags: ["view"],
    status: "pending",
    tokenHash: sha256("valid-token"),
    expiresAt: "2026-07-22T12:00:00.000Z",
    createdByUserId: "owner-user-1",
    createdAt: "2026-06-22T12:00:00.000Z",
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    auditEventIds: [],
    ...overrides,
  };
  ensureCollection("delegatedAccessInvitations").set(invitation.invitationId, invitation);
  return invitation;
}

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body || {},
      query: {},
      headers: {},
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
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("auth delegated access signup", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    createUserMock.mockResolvedValue({ uid: "delegate-user-1" });
  });

  it("creates a delegate identity without provisioning a landlord workspace", async () => {
    seedDelegatedInvitation();
    const router = (await import("../authRoutes")).default;

    const response = await invokeRouter(router, {
      method: "POST",
      url: "/signup",
      body: {
        email: "delegate@example.com",
        password: "secret1",
        fullName: "Delegate User",
        inviteSource: "delegated_access",
        inviteToken: "valid-token",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      id: "delegate-user-1",
      email: "delegate@example.com",
      role: "delegate",
      landlordId: null,
    });
    expect(response.body.showLandlordWelcome).toBe(false);
    expect(ensureCollection("users").get("delegate-user-1")).toMatchObject({
      role: "delegate",
      landlordId: null,
      approvedBy: "delegated_access_invite_signup",
      delegatedAccess: {
        invitationId: "delegated_invitation_1",
        landlordId: "owner-landlord-1",
        role: "property_manager",
      },
    });
    expect(ensureCollection("accounts").get("delegate-user-1")).toMatchObject({
      role: "delegate",
      landlordId: null,
    });
    expect(ensureCollection("landlords").size).toBe(0);
  });

  it("rejects delegated signup email mismatch before creating a user", async () => {
    seedDelegatedInvitation();
    const router = (await import("../authRoutes")).default;

    const response = await invokeRouter(router, {
      method: "POST",
      url: "/signup",
      body: {
        email: "wrong@example.com",
        password: "secret1",
        inviteSource: "delegated_access",
        inviteToken: "valid-token",
      },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INVITEE_EMAIL_MISMATCH");
    expect(createUserMock).not.toHaveBeenCalled();
    expect(ensureCollection("users").size).toBe(0);
    expect(ensureCollection("accounts").size).toBe(0);
    expect(ensureCollection("landlords").size).toBe(0);
  });
});
