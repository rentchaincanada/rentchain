import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((doc) => ({
            id: doc.id,
            exists: true,
            data: () => doc.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

let mockUser: any;

vi.mock("../../firebase", () => ({ db: fakeDb }));
vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!mockUser) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    req.user = mockUser;
    return next();
  },
}));
vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (req.user?.role !== "admin" && !permissions.includes("system.admin")) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return next();
  },
}));

async function invokeRouter(router: any, options: { method: string; url: string; user?: Record<string, unknown> | null }) {
  return await new Promise<{ status: number; body: any; headers: Record<string, string> }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const detailMatch = path.match(/^\/support\/escalations\/(.+)$/);
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      query: Object.fromEntries(new URLSearchParams(queryString || "").entries()),
      params: detailMatch ? { escalationId: decodeURIComponent(detailMatch[1]) } : {},
      headers: {},
      user: mockUser,
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[String(name).toLowerCase()] = value;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) return reject(error);
      resolve({ status: 404, body: { ok: false, error: "NOT_FOUND" }, headers: res.headers });
    });
  });
}

describe("adminSupportEscalationRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedEscalationContext() {
    seedDoc("supportEscalationHistory", "history-1", {
      escalationRefId: "escalation-1",
      category: "credential_secret",
      severity: "critical",
      state: "awaiting_approval",
      actionType: "approval_requested",
      actor: { id: "admin-raw-id", role: "admin", displayName: "Security operator" },
      occurredAt: "2026-05-23T12:00:00.000Z",
      noteSummary: "Bearer abc token=secret gs://bucket/raw.pdf",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      safeEvidenceRefs: [
        {
          referenceType: "incident",
          referenceId: "incident-1",
          label: "Credential incident",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          rawPayload: { providerPayload: "restricted" },
        },
      ],
    });
    seedDoc("supportEscalationReviewNotes", "note-1", {
      escalationRefId: "escalation-1",
      noteType: "security_review_note",
      noteSummary: "authorization=Bearer-secret https://storage.googleapis.com/bucket/raw.pdf",
      author: { id: "support-raw-id", role: "support", displayName: "Support lead" },
      createdAt: "2026-05-23T13:00:00.000Z",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      resourceRefs: [
        {
          referenceType: "review_workspace",
          referenceId: "review-1",
          label: "Review workspace",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          debugPayload: "restricted",
        },
      ],
    });
  }

  it("denies non-admin access and returns admin-only escalation summaries", async () => {
    seedEscalationContext();
    const router = (await import("../adminSupportEscalationRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/support/escalations",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/support/escalations",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("adminSupportEscalationRoutes.ts");
    expect(res.body.escalations).toHaveLength(1);
    expect(res.body.escalations[0]).toEqual(
      expect.objectContaining({
        escalationId: "escalation-1",
        category: "credential_secret",
        severity: "critical",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
      })
    );
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("admin-raw-id");
    expect(payload).not.toContain("support-raw-id");
    expect(payload).not.toContain("Bearer-secret");
    expect(payload).not.toContain("providerPayload");
    expect(payload).not.toContain("debugPayload");
    expect(payload).not.toContain("gs://");
  });

  it("returns safe details and no mutation route", async () => {
    seedEscalationContext();
    const router = (await import("../adminSupportEscalationRoutes")).default;

    const detail = await invokeRouter(router, {
      method: "GET",
      url: "/support/escalations/escalation-1",
    });

    expect(detail.status).toBe(200);
    expect(detail.body.escalation).toEqual(
      expect.objectContaining({
        escalationId: "escalation-1",
        metadataOnly: true,
        historyEntries: expect.any(Array),
        reviewNotes: expect.any(Array),
        prohibitedActions: expect.any(Array),
      })
    );
    expect(JSON.stringify(detail.body)).not.toContain("storage.googleapis.com");

    const post = await invokeRouter(router, {
      method: "POST",
      url: "/support/escalations",
    });
    expect(post.status).toBe(404);
  });

  it("returns a safe empty state when no escalation metadata exists", async () => {
    const router = (await import("../adminSupportEscalationRoutes")).default;

    const res = await invokeRouter(router, { method: "GET", url: "/support/escalations" });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("adminSupportEscalationRoutes.ts");
    expect(res.body.escalations).toEqual([]);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        total: 0,
        metadataOnly: true,
        emptyState: expect.stringContaining("No persisted support escalation history"),
      })
    );
    expect(res.body.schema).toEqual(
      expect.objectContaining({
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        mutationControlsEnabled: false,
      })
    );
  });
});
