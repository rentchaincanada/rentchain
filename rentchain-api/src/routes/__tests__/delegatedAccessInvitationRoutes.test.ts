import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, any>;

const collections = vi.hoisted(() => new Map<string, Map<string, StoredDoc>>());
const generatedIds = vi.hoisted(() => ({ value: 0 }));
const fakeDb = vi.hoisted(() => ({
  collection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    const collection = collections.get(name)!;
    return {
      doc(id?: string) {
        const docId = id || `test_doc_${++generatedIds.value}`;
        return {
          id: docId,
          async get() {
            return {
              id: docId,
              exists: collection.has(docId),
              data: () => collection.get(docId),
            };
          },
          async set(data: StoredDoc) {
            collection.set(docId, data);
          },
          async create(data: StoredDoc) {
            if (collection.has(docId)) throw new Error("already_exists");
            collection.set(docId, data);
          },
        };
      },
      async get() {
        return {
          docs: Array.from(collection.entries()).map(([id, data]) => ({
            id,
            exists: true,
            data: () => data,
          })),
        };
      },
    };
  },
}));

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

function readCollection(name: string): StoredDoc[] {
  return Array.from((collections.get(name) || new Map()).values());
}

function writeCollectionDoc(name: string, id: string, data: StoredDoc) {
  if (!collections.has(name)) collections.set(name, new Map());
  collections.get(name)!.set(id, data);
}

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: Record<string, unknown> }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      body: options.body || {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
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

const ownerUser = { id: "owner-user-1", role: "landlord", landlordId: "landlord-1" };

const validInviteBody = {
  inviteeEmail: "manager@example.com",
  role: "property_manager",
  propertyScope: { mode: "selected", propertyIds: ["property-1"] },
  workspaceScopes: ["dashboard", "operations", "properties"],
  permissionFlags: ["view", "edit", "assign"],
  expiresAt: "2026-07-22T12:00:00.000Z",
};

async function createInvite(router: any, body: Record<string, unknown> = {}, user = ownerUser) {
  return await invokeRouter(router, {
    method: "POST",
    url: "/delegated-access/invitations",
    user,
    body: { ...validInviteBody, ...body },
  });
}

describe("delegatedAccessInvitationRoutes", () => {
  beforeEach(() => {
    collections.clear();
    generatedIds.value = 0;
    vi.clearAllMocks();
  });

  it("allows a landlord owner to create a scoped pending invitation with an audit event", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const response = await createInvite(router, { landlordId: "other-landlord" });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.invitation).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        inviteeEmail: "manager@example.com",
        role: "property_manager",
        status: "pending",
        workspaceScopes: ["dashboard", "operations", "properties"],
      })
    );
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const invitations = readCollection("delegatedAccessInvitations");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toEqual(expect.objectContaining({ tokenHash: expect.any(String) }));
    expect(invitations[0].landlordId).toBe("landlord-1");

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        eventType: "delegated_invite_created",
        actorUserId: "owner-user-1",
        actingForLandlordId: "landlord-1",
        targetResourceType: "delegate_invitation",
        metadataOnly: true,
        immutable: true,
      })
    );
    expect(auditEvents[0].after).not.toHaveProperty("tokenHash");
    expect(auditEvents.map((event) => event.eventType)).not.toContain("delegated_invite_sent");
  });

  it("rejects non-owner invitation creation", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const response = await createInvite(router, {}, { id: "tenant-1", role: "tenant", landlordId: "landlord-1" });

    expect(response.status).toBe(403);
    expect(readCollection("delegatedAccessInvitations")).toHaveLength(0);
  });

  it("rejects invalid roles and invalid scopes", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const invalidRole = await createInvite(router, { role: "owner" });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error).toBe("INVALID_DELEGATED_ROLE");

    const invalidScope = await createInvite(router, { propertyScope: { mode: "selected", propertyIds: [] } });
    expect(invalidScope.status).toBe(400);
    expect(invalidScope.body.error).toBe("MISSING_SELECTED_PROPERTY_SCOPE");

    const ownerOnlyScope = await createInvite(router, { workspaceScopes: ["settings_billing"] });
    expect(ownerOnlyScope.status).toBe(400);
    expect(ownerOnlyScope.body.error).toBe("DELEGATED_BILLING_SCOPE_NOT_ALLOWED");
  });

  it("lists only invitations for the authenticated landlord and ignores query landlord scope", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    await createInvite(router, { inviteeEmail: "manager-1@example.com" }, ownerUser);
    await createInvite(
      router,
      { inviteeEmail: "manager-2@example.com" },
      { id: "owner-user-2", role: "landlord", landlordId: "landlord-2" }
    );

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/invitations?landlordId=landlord-2",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.invitations).toHaveLength(1);
    expect(response.body.invitations[0]).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        inviteeEmail: "manager-1@example.com",
      })
    );
  });

  it("cancels pending invitations and records a metadata-only audit event", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const created = await createInvite(router);
    const invitationId = created.body.invitation.invitationId;

    const response = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${invitationId}/cancel`,
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.invitation.status).toBe("cancelled");
    expect(response.body.invitation.cancelledByUserId).toBe("owner-user-1");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["delegated_invite_created", "delegated_invite_cancelled"])
    );
    expect(auditEvents.find((event) => event.eventType === "delegated_invite_cancelled")).toEqual(
      expect.objectContaining({
        actionType: "invite_cancelled",
        outcome: "allowed",
        metadataOnly: true,
      })
    );
  });

  it("does not allow cancelling accepted or expired invitations", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const accepted = await createInvite(router, { inviteeEmail: "accepted@example.com" });
    const acceptedInvitation = readCollection("delegatedAccessInvitations")[0];
    writeCollectionDoc("delegatedAccessInvitations", accepted.body.invitation.invitationId, {
      ...acceptedInvitation,
      status: "accepted",
      acceptedByUserId: "delegate-user-1",
      acceptedAt: "2026-06-25T12:00:00.000Z",
    });

    const acceptedCancel = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${accepted.body.invitation.invitationId}/cancel`,
      user: ownerUser,
    });
    expect(acceptedCancel.status).toBe(409);

    const expired = await createInvite(router, {
      inviteeEmail: "expired@example.com",
      expiresAt: "2026-06-01T12:00:00.000Z",
    });
    const expireResponse = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${expired.body.invitation.invitationId}/expire`,
      user: ownerUser,
      body: { now: "2026-06-22T12:00:00.000Z" },
    });
    expect(expireResponse.status).toBe(200);
    expect(expireResponse.body.changed).toBe(true);

    const expiredCancel = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${expired.body.invitation.invitationId}/cancel`,
      user: ownerUser,
    });
    expect(expiredCancel.status).toBe(409);
  });

  it("expires stale pending invitations and leaves non-expired invitations unchanged", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const stale = await createInvite(router, { expiresAt: "2026-06-01T12:00:00.000Z" });
    const current = await createInvite(router, {
      inviteeEmail: "current@example.com",
      expiresAt: "2026-08-01T12:00:00.000Z",
    });

    const staleResponse = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${stale.body.invitation.invitationId}/expire`,
      user: ownerUser,
      body: { now: "2026-06-22T12:00:00.000Z" },
    });
    expect(staleResponse.status).toBe(200);
    expect(staleResponse.body.changed).toBe(true);
    expect(staleResponse.body.invitation.status).toBe("expired");

    const currentResponse = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${current.body.invitation.invitationId}/expire`,
      user: ownerUser,
      body: { now: "2026-06-22T12:00:00.000Z" },
    });
    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.changed).toBe(false);
    expect(currentResponse.body.invitation.status).toBe("pending");

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents.map((event) => event.eventType)).toContain("delegated_invite_expired");
  });

  it("denies cross-landlord cancellation attempts", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const created = await createInvite(router, {}, ownerUser);

    const response = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${created.body.invitation.invitationId}/cancel`,
      user: { id: "owner-user-2", role: "landlord", landlordId: "landlord-2" },
    });

    expect(response.status).toBe(404);
  });
});
