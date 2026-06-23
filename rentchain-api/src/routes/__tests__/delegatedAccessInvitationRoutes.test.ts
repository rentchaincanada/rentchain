import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, any>;

const collections = vi.hoisted(() => new Map<string, Map<string, StoredDoc>>());
const generatedIds = vi.hoisted(() => ({ value: 0 }));
const sendEmailMock = vi.hoisted(() => vi.fn(async () => undefined));
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

vi.mock("../../services/emailService", () => ({
  sendEmail: sendEmailMock,
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

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
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

const ownerUser = { id: "owner-user-1", role: "landlord", landlordId: "landlord-1", email: "owner@example.com" };

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

function seedInvitation(overrides: Partial<StoredDoc> = {}) {
  const invitation = {
    invitationId: overrides.invitationId || `delegated_invitation_${readCollection("delegatedAccessInvitations").length + 1}`,
    landlordId: "landlord-1",
    inviteeEmail: "manager@example.com",
    role: "property_manager",
    propertyScope: { mode: "selected", propertyIds: ["property-1"], unitIds: ["unit-1"] },
    workspaceScopes: ["dashboard", "operations", "properties"],
    resourceScope: { workOrderIds: ["work-order-1"] },
    permissionFlags: ["view", "edit", "assign"],
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
  writeCollectionDoc("delegatedAccessInvitations", invitation.invitationId, invitation);
  return invitation;
}

function seedGrant(overrides: Partial<StoredDoc> = {}) {
  const grant = {
    grantId: overrides.grantId || `delegated_grant_${readCollection("delegatedAccessGrants").length + 1}`,
    landlordId: "landlord-1",
    delegateUserId: "delegate-user-1",
    delegateEmail: "manager@example.com",
    role: "property_manager",
    status: "active",
    permissionScope: {
      role: "property_manager",
      workspaceScopes: ["dashboard", "operations", "properties"],
      propertyScope: { mode: "selected", propertyIds: ["property-1"], unitIds: ["unit-1"] },
      resourceScope: { workOrderIds: ["work-order-1"] },
      permissionFlags: ["view", "edit", "assign"],
      billingAccess: false,
      exportAccess: false,
    },
    createdByUserId: "owner-user-1",
    createdAt: "2026-06-22T12:00:00.000Z",
    acceptedAt: "2026-06-22T12:00:00.000Z",
    updatedAt: "2026-06-22T12:00:00.000Z",
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    auditEventIds: [],
    ...overrides,
  };
  writeCollectionDoc("delegatedAccessGrants", grant.grantId, grant);
  return grant;
}

async function acceptInvite(router: any, token = "valid-token", user: Record<string, unknown> | null = {
  id: "delegate-user-1",
  role: "delegate",
  email: "manager@example.com",
}) {
  return await invokeRouter(router, {
    method: "POST",
    url: "/delegated-access/invitations/accept",
    user,
    body: { token },
  });
}

describe("delegatedAccessInvitationRoutes", () => {
  beforeEach(() => {
    collections.clear();
    generatedIds.value = 0;
    vi.clearAllMocks();
    process.env.EMAIL_FROM = "no-reply@example.test";
    delete process.env.DELEGATED_ACCESS_ACCEPTANCE_BASE_URL;
    delete process.env.DELEGATED_ACCESS_FRONTEND_URL;
    process.env.PUBLIC_APP_URL = "https://app.example.test";
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("allows a landlord owner to create a scoped pending invitation and dispatches email without token response leakage", async () => {
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
        emailDispatch: expect.objectContaining({ status: "sent", attemptCount: 1 }),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");
    expect(response.body.emailDispatch).toEqual({ status: "sent" });

    const invitations = readCollection("delegatedAccessInvitations");
    expect(invitations).toHaveLength(1);
    expect(invitations[0]).toEqual(
      expect.objectContaining({
        tokenHash: expect.any(String),
        emailDispatch: expect.objectContaining({ status: "sent", attemptCount: 1 }),
      })
    );
    expect(invitations[0].landlordId).toBe("landlord-1");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const emailPayload = sendEmailMock.mock.calls[0][0];
    expect(emailPayload.to).toBe("manager@example.com");
    expect(emailPayload.subject).toContain("owner@example.com");
    expect(emailPayload.text).toContain("Assigned role: Property Manager");
    expect(emailPayload.text).toContain("Use your own RentChain account");
    expect(emailPayload.text).toContain("/delegated-access/accept?token=");
    const rawToken = String(emailPayload.text).match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(rawToken).toBeTruthy();
    expect(sha256(rawToken!)).toBe(invitations[0].tokenHash);
    expect(JSON.stringify(response.body)).not.toContain(rawToken!);

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents).toHaveLength(2);
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
    expect(auditEvents[1]).toEqual(
      expect.objectContaining({
        eventType: "delegated_invite_sent",
        actionType: "invite_email_dispatched",
        outcome: "allowed",
        metadataOnly: true,
      })
    );
    expect(JSON.stringify(auditEvents)).not.toContain(rawToken!);
    expect(JSON.stringify(auditEvents)).not.toContain("tokenHash");
  });

  it("uses the delegated access acceptance URL override for preview email links", async () => {
    process.env.DELEGATED_ACCESS_ACCEPTANCE_BASE_URL = "https://rentchain-preview.vercel.app";
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const response = await createInvite(router);

    expect(response.status).toBe(201);
    const emailPayload = sendEmailMock.mock.calls[0][0];
    expect(emailPayload.text).toContain("https://rentchain-preview.vercel.app/delegated-access/accept?token=");
  });

  it("rejects non-owner invitation creation", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const response = await createInvite(router, {}, { id: "tenant-1", role: "tenant", landlordId: "landlord-1" });

    expect(response.status).toBe(403);
    expect(readCollection("delegatedAccessInvitations")).toHaveLength(0);
  });

  it("keeps created invitation retryable when initial email dispatch fails", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("mail_failed secret_token_like_value_abcdefghijklmnopqrstuvwxyz"));
    const router = (await import("../delegatedAccessInvitationRoutes")).default;

    const response = await createInvite(router);

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);
    expect(response.body.emailDispatch).toEqual({ status: "failed" });
    expect(response.body.invitation.emailDispatch).toEqual(
      expect.objectContaining({
        status: "failed",
        attemptCount: 1,
        lastFailureReason: expect.stringContaining("mail_failed"),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain("secret_token_like_value");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const invitations = readCollection("delegatedAccessInvitations");
    expect(invitations).toHaveLength(1);
    expect(invitations[0].status).toBe("pending");
    expect(invitations[0].emailDispatch.status).toBe("failed");

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents.map((event) => event.eventType)).toEqual([
      "delegated_invite_created",
      "delegated_invite_sent",
    ]);
    const failedEvent = auditEvents[1];
    expect(failedEvent).toEqual(
      expect.objectContaining({
        actionType: "invite_email_dispatch_failed",
        outcome: "failed",
        metadataOnly: true,
      })
    );
    expect(JSON.stringify(failedEvent)).not.toContain("secret_token_like_value");
    expect(JSON.stringify(failedEvent)).not.toContain("tokenHash");
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

  it("resends pending unexpired invitations and refreshes the stored token hash without token response leakage", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const created = await createInvite(router);
    const invitationId = created.body.invitation.invitationId;
    const originalHash = readCollection("delegatedAccessInvitations")[0].tokenHash;
    sendEmailMock.mockClear();

    const response = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${invitationId}/resend`,
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.emailDispatch).toEqual({ status: "sent" });
    expect(response.body.invitation.emailDispatch).toEqual(
      expect.objectContaining({ status: "sent", attemptCount: 2 })
    );
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    const emailPayload = sendEmailMock.mock.calls[0][0];
    const rawToken = String(emailPayload.text).match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(rawToken).toBeTruthy();
    const updatedInvitation = readCollection("delegatedAccessInvitations")[0];
    expect(updatedInvitation.tokenHash).not.toBe(originalHash);
    expect(updatedInvitation.tokenHash).toBe(sha256(rawToken!));
    expect(JSON.stringify(response.body)).not.toContain(rawToken!);

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents.map((event) => event.actionType)).toContain("invite_email_resent");
    expect(JSON.stringify(auditEvents)).not.toContain(rawToken!);
    expect(JSON.stringify(auditEvents)).not.toContain("tokenHash");
  });

  it("preserves existing token hash and marks retryable failure when resend dispatch fails", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const created = await createInvite(router);
    const invitationId = created.body.invitation.invitationId;
    const originalHash = readCollection("delegatedAccessInvitations")[0].tokenHash;
    sendEmailMock.mockRejectedValueOnce(new Error("provider_unavailable secret_token_like_value_abcdefghijklmnopqrstuvwxyz"));

    const response = await invokeRouter(router, {
      method: "POST",
      url: `/delegated-access/invitations/${invitationId}/resend`,
      user: ownerUser,
    });

    expect(response.status).toBe(502);
    expect(response.body.ok).toBe(false);
    expect(response.body.error).toBe("EMAIL_DISPATCH_FAILED");
    expect(response.body.invitation.emailDispatch).toEqual(
      expect.objectContaining({ status: "failed", attemptCount: 2 })
    );
    const updatedInvitation = readCollection("delegatedAccessInvitations")[0];
    expect(updatedInvitation.tokenHash).toBe(originalHash);
    expect(updatedInvitation.emailDispatch.status).toBe("failed");
    expect(JSON.stringify(response.body)).not.toContain("secret_token_like_value");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const failedEvent = readCollection("delegatedAccessAuditEvents").find(
      (event) => event.actionType === "invite_email_resend_failed"
    );
    expect(failedEvent).toEqual(expect.objectContaining({ outcome: "failed", metadataOnly: true }));
    expect(JSON.stringify(failedEvent)).not.toContain("secret_token_like_value");
    expect(JSON.stringify(failedEvent)).not.toContain("tokenHash");
  });

  it("fails closed when resending non-pending, expired, or cross-landlord invitations", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation({ invitationId: "accepted-invitation", status: "accepted", acceptedByUserId: "delegate-1" });
    seedInvitation({
      invitationId: "expired-invitation",
      expiresAt: "2026-06-01T12:00:00.000Z",
      tokenHash: sha256("expired-resend-token"),
    });
    seedInvitation({
      invitationId: "other-landlord-invitation",
      landlordId: "landlord-2",
      tokenHash: sha256("other-landlord-token"),
    });

    const accepted = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/invitations/accepted-invitation/resend",
      user: ownerUser,
    });
    expect(accepted.status).toBe(409);

    const expired = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/invitations/expired-invitation/resend",
      user: ownerUser,
    });
    expect(expired.status).toBe(410);

    const crossLandlord = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/invitations/other-landlord-invitation/resend",
      user: ownerUser,
    });
    expect(crossLandlord.status).toBe(404);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("accepts a valid pending token for the authenticated delegate account", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation();

    const response = await acceptInvite(router);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.invitation).toEqual(
      expect.objectContaining({
        status: "accepted",
        acceptedByUserId: "delegate-user-1",
        landlordId: "landlord-1",
        role: "property_manager",
      })
    );
    expect(response.body.grant).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        delegateUserId: "delegate-user-1",
        delegateEmail: "manager@example.com",
        role: "property_manager",
        status: "active",
      })
    );
    expect(response.body.grant.permissionScope).toEqual(
      expect.objectContaining({
        role: "property_manager",
        workspaceScopes: ["dashboard", "operations", "properties"],
        propertyScope: { mode: "selected", propertyIds: ["property-1"], unitIds: ["unit-1"] },
        resourceScope: expect.objectContaining({ workOrderIds: ["work-order-1"] }),
        permissionFlags: ["view", "edit", "assign"],
        billingAccess: false,
      })
    );
    expect(JSON.stringify(response.body)).not.toContain("valid-token");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const storedInvitation = readCollection("delegatedAccessInvitations")[0];
    expect(storedInvitation.status).toBe("accepted");
    expect(storedInvitation.tokenHash).toBe(sha256("valid-token"));

    const grants = readCollection("delegatedAccessGrants");
    expect(grants).toHaveLength(1);
    expect(grants[0].delegateUserId).toBe("delegate-user-1");
    expect(grants[0].permissionScope.billingAccess).toBe(false);

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        eventType: "delegated_invite_accepted",
        actorUserId: "delegate-user-1",
        actingForLandlordId: "landlord-1",
        delegatedRole: "property_manager",
        targetResourceType: "delegate_invitation",
        targetResourceId: "delegated_invitation_1",
        metadataOnly: true,
        immutable: true,
      })
    );
    expect(JSON.stringify(auditEvents[0])).not.toContain("valid-token");
    expect(JSON.stringify(auditEvents[0])).not.toContain("tokenHash");
  });

  it("rejects invalid tokens without leaking token data", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation();

    const response = await acceptInvite(router, "wrong-token");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ ok: false, error: "INVITATION_NOT_FOUND" });
    expect(JSON.stringify(response.body)).not.toContain("wrong-token");
    expect(readCollection("delegatedAccessGrants")).toHaveLength(0);
  });

  it("rejects expired, cancelled, and already accepted invitations without creating duplicate grants", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation({
      invitationId: "expired-invitation",
      tokenHash: sha256("expired-token"),
      expiresAt: "2026-06-01T12:00:00.000Z",
    });
    seedInvitation({
      invitationId: "cancelled-invitation",
      tokenHash: sha256("cancelled-token"),
      status: "cancelled",
      cancelledByUserId: "owner-user-1",
      cancelledAt: "2026-06-20T12:00:00.000Z",
    });
    seedInvitation({
      invitationId: "accepted-invitation",
      tokenHash: sha256("accepted-token"),
      status: "accepted",
      acceptedByUserId: "delegate-user-2",
      acceptedAt: "2026-06-20T12:00:00.000Z",
    });

    const expired = await acceptInvite(router, "expired-token");
    expect(expired.status).toBe(410);
    expect(expired.body.error).toBe("INVITATION_EXPIRED");

    const cancelled = await acceptInvite(router, "cancelled-token");
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.error).toBe("INVITATION_NOT_PENDING");

    const accepted = await acceptInvite(router, "accepted-token");
    expect(accepted.status).toBe(409);
    expect(accepted.body.error).toBe("INVITATION_NOT_PENDING");

    expect(readCollection("delegatedAccessGrants")).toHaveLength(0);
  });

  it("requires an authenticated invited delegate user and rejects mismatched or owner sessions", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation();

    const unauthenticated = await acceptInvite(router, "valid-token", null);
    expect(unauthenticated.status).toBe(401);

    const mismatched = await acceptInvite(router, "valid-token", {
      id: "actual-delegate-user",
      role: "delegate",
      email: "different@example.com",
    });
    expect(mismatched.status).toBe(403);
    expect(mismatched.body.error).toBe("INVITEE_EMAIL_MISMATCH");

    const ownerSession = await acceptInvite(router, "valid-token", {
      id: "manager-owner-user",
      role: "landlord",
      landlordId: "manager-owner-user",
      email: "manager@example.com",
    });
    expect(ownerSession.status).toBe(403);
    expect(ownerSession.body.error).toBe("DELEGATE_ACCOUNT_ROLE_CONFLICT");
    expect(readCollection("delegatedAccessGrants")).toHaveLength(0);
  });

  it("rejects double acceptance without creating a duplicate grant", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedInvitation();

    const first = await acceptInvite(router);
    expect(first.status).toBe(200);

    const second = await acceptInvite(router);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("INVITATION_NOT_PENDING");
    expect(readCollection("delegatedAccessGrants")).toHaveLength(1);
    expect(readCollection("delegatedAccessAuditEvents")).toHaveLength(1);
  });

  it("lists grants for the authenticated landlord only and ignores query landlord scope", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedGrant({ grantId: "active-grant", status: "active" });
    seedGrant({
      grantId: "revoked-grant",
      status: "revoked",
      revokedAt: "2026-06-23T12:00:00.000Z",
      revokedByUserId: "owner-user-1",
      updatedAt: "2026-06-23T12:00:00.000Z",
    });
    seedGrant({ grantId: "other-landlord-grant", landlordId: "landlord-2" });
    seedGrant({ grantId: "suspended-grant", status: "suspended" });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/grants?landlordId=landlord-2",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.grants.map((grant: any) => grant.grantId).sort()).toEqual(["active-grant", "revoked-grant"]);
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");
    expect(JSON.stringify(response.body)).not.toContain("valid-token");
  });

  it("lists only active grants assigned to the authenticated delegate without property ids", async () => {
    const { default: router, delegatedAccessSelfRoutes } = await import("../delegatedAccessInvitationRoutes");
    writeCollectionDoc("users", "landlord-1", { email: "owner@example.com", displayName: "Owner Raw Label" });
    writeCollectionDoc("accounts", "landlord-2", { email: "elite-owner@example.com" });
    seedGrant({ grantId: "delegate-active-grant", status: "active" });
    seedGrant({
      grantId: "delegate-second-active-grant",
      landlordId: "landlord-2",
      status: "active",
      updatedAt: "2026-06-23T12:00:00.000Z",
      permissionScope: {
        role: "property_manager",
        workspaceScopes: ["dashboard", "operations", "properties"],
        propertyScope: { mode: "selected", propertyIds: ["property-2"], unitIds: ["unit-2"] },
        resourceScope: { workOrderIds: ["work-order-2"] },
        permissionFlags: ["view", "edit", "assign"],
        billingAccess: false,
        exportAccess: false,
      },
    });
    seedGrant({ grantId: "delegate-revoked-grant", status: "revoked" });
    seedGrant({ grantId: "other-delegate-active-grant", delegateUserId: "delegate-user-2", status: "active" });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/my-grants?landlordId=landlord-2",
      user: { id: "delegate-user-1", role: "delegate", email: "manager@example.com" },
    });

    expect(response.status).toBe(200);
    expect(response.body.grants).toHaveLength(2);
    expect(response.body.grants.map((grant: any) => grant.landlordWorkspaceLabel).sort()).toEqual([
      "elite-owner@example.com",
      "owner@example.com",
    ]);
    expect(response.body.grants[0]).toEqual(
      expect.objectContaining({
        delegateEmail: "manager@example.com",
        role: "property_manager",
        status: "active",
        propertyScopeSummary: "selected:1",
        permissionScope: expect.objectContaining({
          workspaceScopes: ["dashboard", "operations", "properties"],
          propertyScope: { mode: "selected", propertyIds: [], unitIds: [] },
        }),
      })
    );
    expect(JSON.stringify(response.body)).not.toContain("landlord-1");
    expect(JSON.stringify(response.body)).not.toContain("landlord-2");
    expect(JSON.stringify(response.body)).not.toContain("delegate-active-grant");
    expect(JSON.stringify(response.body)).not.toContain("delegate-second-active-grant");
    expect(JSON.stringify(response.body)).not.toContain("delegate-user-1");
    expect(JSON.stringify(response.body)).not.toContain("property-1");
    expect(JSON.stringify(response.body)).not.toContain("property-2");
    expect(JSON.stringify(response.body)).not.toContain("unit-1");
    expect(JSON.stringify(response.body)).not.toContain("unit-2");
    expect(JSON.stringify(response.body)).not.toContain("tokenHash");

    const selfRouteResponse = await invokeRouter(delegatedAccessSelfRoutes, {
      method: "GET",
      url: "/my-grants",
      user: { id: "delegate-user-1", role: "delegate", email: "manager@example.com" },
    });

    expect(selfRouteResponse.status).toBe(200);
    expect(selfRouteResponse.body.grants).toHaveLength(2);
    expect(JSON.stringify(selfRouteResponse.body)).not.toContain("property-1");
  });

  it("keeps delegated self grants authenticated and delegate-scoped", async () => {
    const { delegatedAccessSelfRoutes } = await import("../delegatedAccessInvitationRoutes");
    seedGrant({ grantId: "delegate-active-grant", status: "active" });

    const unauthenticated = await invokeRouter(delegatedAccessSelfRoutes, {
      method: "GET",
      url: "/my-grants",
      user: null,
    });
    expect(unauthenticated.status).toBe(401);

    const ownerSession = await invokeRouter(delegatedAccessSelfRoutes, {
      method: "GET",
      url: "/my-grants",
      user: ownerUser,
    });
    expect(ownerSession.status).toBe(403);

    const wrongDelegate = await invokeRouter(delegatedAccessSelfRoutes, {
      method: "GET",
      url: "/my-grants",
      user: { id: "delegate-user-2", role: "delegate", email: "other@example.com" },
    });
    expect(wrongDelegate.status).toBe(200);
    expect(wrongDelegate.body.grants).toEqual([]);
  });

  it("lists delegate summaries for active and revoked grants", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedGrant({ grantId: "active-grant" });
    seedGrant({
      grantId: "revoked-grant",
      status: "revoked",
      role: "maintenance_coordinator",
      revokedAt: "2026-06-23T12:00:00.000Z",
      revokedByUserId: "owner-user-1",
      updatedAt: "2026-06-23T12:00:00.000Z",
      permissionScope: {
        role: "maintenance_coordinator",
        workspaceScopes: ["work_orders"],
        propertyScope: { mode: "selected", propertyIds: ["property-2"] },
        resourceScope: {},
        permissionFlags: ["view", "assign"],
        billingAccess: false,
        exportAccess: false,
      },
    });
    seedGrant({
      grantId: "second-delegate",
      delegateUserId: "delegate-user-2",
      delegateEmail: "auditor@example.com",
      role: "read_only_auditor",
      permissionScope: {
        role: "read_only_auditor",
        workspaceScopes: ["evidence_exports"],
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        resourceScope: {},
        permissionFlags: ["view", "export"],
        billingAccess: false,
        exportAccess: true,
      },
    });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/delegates?landlordId=landlord-2",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.delegates).toHaveLength(2);
    expect(response.body.delegates[0]).toEqual(
      expect.objectContaining({
        delegateUserId: expect.any(String),
        roles: expect.any(Array),
        activeGrantCount: expect.any(Number),
        revokedGrantCount: expect.any(Number),
        workspaceScopes: expect.any(Array),
      })
    );
    const manager = response.body.delegates.find((delegate: any) => delegate.delegateUserId === "delegate-user-1");
    expect(manager).toEqual(
      expect.objectContaining({
        delegateEmail: "manager@example.com",
        roles: ["maintenance_coordinator", "property_manager"],
        activeGrantCount: 1,
        revokedGrantCount: 1,
        propertyScopeSummary: "selected:2",
      })
    );
    expect(manager.workspaceScopes).toEqual(["dashboard", "operations", "properties", "work_orders"]);
  });

  it("requires owner privileges for delegate and grant management routes", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedGrant();
    const delegateUser = { id: "delegate-user-1", role: "delegate", landlordId: null };

    const delegates = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/delegates",
      user: delegateUser,
    });
    expect(delegates.status).toBe(403);

    const grants = await invokeRouter(router, {
      method: "GET",
      url: "/delegated-access/grants",
      user: delegateUser,
    });
    expect(grants.status).toBe(403);

    const revoke = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/grants/delegated_grant_1/revoke",
      user: delegateUser,
      body: { reason: "turnover" },
    });
    expect(revoke.status).toBe(403);
  });

  it("revokes an active grant without deleting it and records metadata-only audit", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    const { evaluateDelegatedAccessPermission } = await import("../../lib/delegatedAccess");
    seedGrant({ grantId: "grant-to-revoke" });

    const response = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/grants/grant-to-revoke/revoke",
      user: ownerUser,
      body: { reason: "Staff turnover", landlordId: "landlord-2" },
    });

    expect(response.status).toBe(200);
    expect(response.body.grant).toEqual(
      expect.objectContaining({
        grantId: "grant-to-revoke",
        landlordId: "landlord-1",
        status: "revoked",
        revokedByUserId: "owner-user-1",
        revocationReason: "Staff turnover",
      })
    );
    expect(readCollection("delegatedAccessGrants")).toHaveLength(1);
    expect(readCollection("delegatedAccessGrants")[0].status).toBe("revoked");

    const decision = evaluateDelegatedAccessPermission({
      actorUserId: "delegate-user-1",
      actingForLandlordId: "landlord-1",
      isLandlordOwner: false,
      routeWorkspace: "operations",
      action: "view",
      targetResourceType: "operation",
      propertyId: "property-1",
      resourceId: "work-order-1",
      grant: response.body.grant,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("grant_not_active");

    const auditEvents = readCollection("delegatedAccessAuditEvents");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        eventType: "delegated_access_revoked",
        actorUserId: "owner-user-1",
        actingForLandlordId: "landlord-1",
        delegatedRole: "landlord_owner",
        actionType: "grant_revoked",
        targetResourceType: "delegate_grant",
        targetResourceId: "grant-to-revoke",
        outcome: "revoked",
        metadataOnly: true,
        immutable: true,
      })
    );
    expect(auditEvents[0].after).toEqual(
      expect.objectContaining({
        status: "revoked",
        delegateUserId: "delegate-user-1",
        role: "property_manager",
        propertyScopeMode: "selected",
        reason: "Staff turnover",
      })
    );
    expect(JSON.stringify(auditEvents[0])).not.toContain("tokenHash");
    expect(JSON.stringify(auditEvents[0])).not.toContain("valid-token");
  });

  it("fails closed for unknown, cross-landlord, and already revoked grant revocation", async () => {
    const router = (await import("../delegatedAccessInvitationRoutes")).default;
    seedGrant({ grantId: "other-landlord-grant", landlordId: "landlord-2" });
    seedGrant({
      grantId: "already-revoked",
      status: "revoked",
      revokedByUserId: "owner-user-1",
      revokedAt: "2026-06-23T12:00:00.000Z",
      updatedAt: "2026-06-23T12:00:00.000Z",
    });

    const unknown = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/grants/missing-grant/revoke",
      user: ownerUser,
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe("GRANT_NOT_FOUND");

    const crossLandlord = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/grants/other-landlord-grant/revoke",
      user: ownerUser,
    });
    expect(crossLandlord.status).toBe(404);

    const alreadyRevoked = await invokeRouter(router, {
      method: "POST",
      url: "/delegated-access/grants/already-revoked/revoke",
      user: ownerUser,
    });
    expect(alreadyRevoked.status).toBe(409);
    expect(alreadyRevoked.body.error).toBe("GRANT_NOT_ACTIVE");
    expect(readCollection("delegatedAccessAuditEvents")).toHaveLength(0);
  });
});
