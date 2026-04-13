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

function queryCollection(name: string, filters: Array<{ field: string; op: string; value: any }>, limitCount?: number) {
  let docs = Array.from(ensureCollection(name).entries())
    .filter(([, data]) =>
      filters.every((filter) => {
        const current = data?.[filter.field];
        if (filter.op === "==") return current === filter.value;
        if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
        return false;
      })
    )
    .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));

  if (typeof limitCount === "number") {
    docs = docs.slice(0, limitCount);
  }

  return { docs, empty: docs.length === 0 };
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
      limit: (count: number) => ({
        get: async () => queryCollection(name, [{ field, op, value }], count),
      }),
      get: async () => queryCollection(name, [{ field, op, value }]),
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) {
      req.user = JSON.parse(header);
    }
    next();
  },
}));

describe("tenantPortalRoutes foundation", () => {
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
    collections.clear();
    ensureCollection("properties").set("prop-1", {
      rc_prop_id: "rc-prop-1",
      street1: "123 Main St",
      street2: "Unit 4",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H1A1",
      features: ["laundry", "parking"],
      internalSecret: "do-not-expose",
      landlordId: "landlord-1",
    });
    ensureCollection("applications").set("app-1", {
      applicantEmail: "tenant@example.com",
      propertyId: "prop-1",
      status: "submitted",
      missingSteps: ["upload_id"],
      nextActions: ["finish_profile"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sin: "123-45-6789",
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "active",
      startDate: "2026-02-01",
      endDate: "2027-01-31",
      monthlyRent: 1800,
      documentUrl: "https://example.com/lease.pdf",
      confidentialNotes: "private",
    });
    ensureCollection("tenants").set("tenant-1", {
      email: "tenant@example.com",
      fullName: "Taylor Tenant",
      phone: "902-555-0100",
      internalNotes: "do-not-expose",
    });
    ensureCollection("maintenanceRequests").set("maint-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      status: "submitted",
      priority: "NORMAL",
      category: "GENERAL",
      title: "Leaky tap",
      description: "Kitchen faucet dripping",
      assignedContractorName: "North Shore Plumbing",
      contractorStatus: "assigned",
      serviceWindowStartAt: 300,
      serviceWindowEndAt: 600,
      accessRequired: true,
      statusHistory: [
        {
          status: "submitted",
          actorRole: "tenant",
          message: "Submitted from tenant workspace.",
          createdAt: 100,
        },
      ],
      createdAt: 100,
      updatedAt: 200,
      internalCost: 999,
    });
    ensureCollection("tenancy_invites").set("invite-1", {
      token_hash: "invite-1",
      token_preview: "abc123",
      landlord_id: "landlord-1",
      property_id: "prop-1",
      application_id: "app-1",
      invited_email: "tenant@example.com",
      status: "pending",
      created_at: Date.now(),
      expires_at: Date.now() + 10_000,
    });
    ensureCollection("ledgerAttachments").set("attachment-1", {
      tenantId: "tenant-1",
      ledgerItemId: "ledger-1",
      title: "Government ID",
      fileName: "id-card.pdf",
      purpose: "identity",
      purposeLabel: "Upload Id",
      url: "https://example.com/id-card.pdf",
      createdAt: 500,
      internalNotes: "private",
    });
    ensureCollection("tenantHistoryShares").set("share-1", {
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      createdAt: 1_000,
      expiresAt: Date.now() + 86_400_000,
      lastAccessedAt: 2_000,
      revoked: false,
    });
    ensureCollection("tenantHistoryShares").set("share-2", {
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      createdAt: 900,
      expiresAt: Date.now() + 86_400_000,
      revoked: true,
      revokedAt: 1_500,
    });
  });

  it("rejects unauthorized tenant workspace access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
    });

    expect(res.status).toBe(401);
  });

  it("returns safe projected workspace data and writes compact events", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/workspace",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.property?.street1).toBe("123 Main St");
    expect(res.body?.data?.property?.internalSecret).toBeUndefined();
    expect(res.body?.data?.application?.status).toBe("submitted");
    expect(res.body?.data?.application?.sin).toBeUndefined();
    expect(res.body?.data?.lease?.monthlyRent).toBe(1800);
    expect(res.body?.data?.lease?.confidentialNotes).toBeUndefined();
    expect(res.body?.data?.maintenance?.[0]?.title).toBe("Leaky tap");
    expect(res.body?.data?.maintenance?.[0]?.assignedContractorName).toBe("North Shore Plumbing");
    expect(res.body?.data?.maintenance?.[0]?.contractorStatus).toBe("assigned");
    expect(res.body?.data?.maintenance?.[0]?.serviceWindowStartAt).toBe(300);
    expect(res.body?.data?.maintenance?.[0]?.accessRequired).toBe(true);
    expect(res.body?.data?.maintenance?.[0]?.statusHistory?.[0]?.message).toBe("Submitted from tenant workspace.");
    expect(res.body?.data?.maintenance?.[0]?.internalCost).toBeUndefined();

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_workspace_viewed")).toBe(true);
  });

  it("returns a grouped tenant-safe application completion checklist", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.progressPercent).toBeTypeOf("number");
    expect(Array.isArray(res.body?.data?.sections)).toBe(true);
    expect(res.body?.data?.sections?.map((section: any) => section.key)).toEqual(
      expect.arrayContaining(["identity", "documents", "profile", "readiness"])
    );
    expect(res.body?.data?.sections?.some((section: any) => Array.isArray(section.items) && section.items.length > 0)).toBe(true);
    expect(res.body?.data?.sections?.flatMap((section: any) => section.items || [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ internalSecret: expect.anything() })])
    );
    expect(res.body?.data?.sections?.flatMap((section: any) => section.items || [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sin: expect.anything() })])
    );
    const documentItem = res.body?.data?.sections
      ?.flatMap((section: any) => section.items || [])
      ?.find((item: any) => item.key === "upload_id");
    expect(documentItem?.actionPath).toBe("/tenant/attachments");

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_application_completion_viewed")).toBe(true);
  });

  it("rejects unauthorized application completion access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
    });

    expect(res.status).toBe(401);
  });

  it("handles missing application context safely in the completion engine", async () => {
    ensureCollection("applications").clear();

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/application-completion",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toMatch(/not_started|in_progress|pending|needs_review/);
    expect(Array.isArray(res.body?.data?.sections)).toBe(true);
    const readinessSection = res.body?.data?.sections?.find((section: any) => section.key === "readiness");
    expect(readinessSection).toBeTruthy();
  });

  it("returns tenant-safe document states and completion guidance", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/attachments",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body?.summary?.total).toBeGreaterThan(0);
    expect(res.body?.summary?.pendingReview).toBeTypeOf("number");
    expect(res.body?.guidance?.headline).toBeTypeOf("string");
    expect(res.body?.data?.[0]?.internalNotes).toBeUndefined();
    expect(
      res.body?.data?.some((item: any) =>
        ["uploaded", "missing", "pending_review", "verified", "needs_attention", "reupload_requested"].includes(item.status)
      )
    ).toBe(true);
  });

  it("rejects unauthorized tenant attachments access", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/attachments",
    });

    expect(res.status).toBe(401);
  });

  it("returns tenant-safe profile data with edit and document entry actions", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.displayName).toBe("Taylor Tenant");
    expect(res.body?.data?.profile?.phone).toBe("902-555-0100");
    expect(res.body?.data?.profile?.internalNotes).toBeUndefined();
    expect(res.body?.data?.actions?.editableFields).toEqual(["displayName", "phone"]);
    expect(res.body?.data?.actions?.documentEntry?.path).toBe("/tenant/attachments");
  });

  it("returns tenant-safe access visibility from existing share records", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/access",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.summary?.activeGrants).toBe(1);
    expect(res.body?.data?.summary?.pendingRequests).toBe(0);
    expect(res.body?.data?.activeAccess?.[0]?.grantedToLabel).toMatch(/Shared with your landlord/i);
    expect(res.body?.data?.activeAccess?.[0]?.categories).toEqual(["Rental history"]);
    expect(res.body?.data?.pendingRequests).toEqual([]);
    expect(
      res.body?.data?.recentActivity?.some((item: any) =>
        ["access_granted", "access_viewed", "access_revoked"].includes(item.type)
      )
    ).toBe(true);

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_access_viewed")).toBe(true);
  });

  it("allows a tenant to revoke only their own active access share", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/access/share-1/revoke",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.revoked).toBe(true);
    expect(ensureCollection("tenantHistoryShares").get("share-1")?.revoked).toBe(true);

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_access_revoked")).toBe(true);
  });

  it("updates only allowed tenant profile fields", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        displayName: "Taylor Updated",
        phone: "902-555-0111",
        internalNotes: "should-not-stick",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.profile?.displayName).toBe("Taylor Updated");
    expect(res.body?.data?.profile?.phone).toBe("902-555-0111");
    expect(ensureCollection("tenants").get("tenant-1")?.fullName).toBe("Taylor Updated");
    expect(ensureCollection("tenants").get("tenant-1")?.phone).toBe("902-555-0111");
    expect(ensureCollection("tenants").get("tenant-1")?.internalNotes).toBe("do-not-expose");
    expect(ensureCollection("applications").get("app-1")?.applicantName).toBe("Taylor Updated");
    expect(ensureCollection("applications").get("app-1")?.phone).toBe("902-555-0111");

    const eventDocs = Array.from(ensureCollection("event_log").values());
    expect(eventDocs.some((event) => event.event_type === "tenant_profile_updated")).toBe(true);
  });

  it("rejects unauthorized tenant profile edits", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "PATCH",
      url: "/profile",
      body: {
        displayName: "Taylor Updated",
      },
    });

    expect(res.status).toBe(401);
  });

  it("submits maintenance only for active tenant context", async () => {
    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/maintenance-requests",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: {
        title: "Broken lock",
        description: "Front door lock is jammed",
        category: "SECURITY",
        priority: "HIGH",
      },
    });

    expect(res.status).toBe(201);
    expect(res.body?.data?.title).toBe("Broken lock");
    expect(Array.from(ensureCollection("event_log").values()).some((event) => event.event_type === "tenant_maintenance_submitted")).toBe(true);
  });

  it("redeems invite token once for an authenticated user", async () => {
    const { hashTenancyInviteToken } = await import("../../services/tenantPortal/tenantInviteService");
    const token = "plain-invite-token";
    const tokenHash = hashTenancyInviteToken(token);
    ensureCollection("tenancy_invites").set(tokenHash, {
      token_hash: tokenHash,
      token_preview: "plain-...oken",
      landlord_id: "landlord-1",
      property_id: "prop-1",
      application_id: "app-1",
      invited_email: "tenant@example.com",
      status: "pending",
      created_at: Date.now(),
      expires_at: Date.now() + 10_000,
    });

    const router = (await import("../tenantPortalRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/invite/redeem",
      headers: {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "tenant@example.com",
          role: "tenant",
          tenantId: "tenant-1",
        }),
      },
      body: { token },
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.status).toBe("redeemed");
  });
});
