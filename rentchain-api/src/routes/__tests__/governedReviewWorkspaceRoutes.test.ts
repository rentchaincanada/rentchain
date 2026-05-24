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

vi.mock("../../config/firebase", () => ({ db: fakeDb }));
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
    const detailMatch = path.match(/^\/review-workspaces\/(.+)$/);
    mockUser = options.user ?? mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      query: Object.fromEntries(new URLSearchParams(queryString || "").entries()),
      params: detailMatch ? { workspaceId: decodeURIComponent(detailMatch[1]) } : {},
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

describe("governedReviewWorkspaceRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  function seedWorkspace() {
    seedDoc("governedReviewWorkspaceAppendLog", "workspace-1", {
      record: {
        workspaceType: "security_review",
        title: "Security review workspace",
        summary: "Metadata-only workspace.",
        workflowFamily: "admin_security_incident_review",
        retentionClass: "security_review",
        retentionReason: "token=secret gs://bucket/raw.pdf",
        createdAt: "2026-05-24T01:00:00.000Z",
        lastAppendedAt: "2026-05-24T01:05:00.000Z",
        safeEvidenceRefs: [
          {
            referenceType: "document",
            referenceId: "doc-safe",
            label: "https://storage.googleapis.com/bucket/raw.pdf",
            landlordId: "landlord-raw",
            tenantId: "tenant-raw",
          },
        ],
        appendEventRefs: [
          {
            eventType: "workspace_evidence_ref_added",
            eventSummary: "authorization=Bearer-secret responseBody={raw}",
            occurredAt: "2026-05-24T01:05:00.000Z",
          },
        ],
      },
    });
  }

  it("denies non-admin access and returns route-owned metadata-only workspace summaries", async () => {
    seedWorkspace();
    const router = (await import("../governedReviewWorkspaceRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/review-workspaces",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });
    expect(forbidden.status).toBe(403);

    const res = await invokeRouter(router, {
      method: "GET",
      url: "/review-workspaces",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("governedReviewWorkspaceRoutes.ts");
    expect(res.body.workspaces).toHaveLength(1);
    expect(res.body.workspaces[0]).toEqual(
      expect.objectContaining({
        workspaceType: "security_review",
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        mutationControlsEnabled: false,
        rawPayloadAccessEnabled: false,
      })
    );
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("landlord-raw");
    expect(payload).not.toContain("tenant-raw");
    expect(payload).not.toContain("storage.googleapis.com");
    expect(payload).not.toContain("token=secret");
  });

  it("returns safe detail and no mutation route", async () => {
    seedWorkspace();
    const router = (await import("../governedReviewWorkspaceRoutes")).default;
    const list = await invokeRouter(router, { method: "GET", url: "/review-workspaces" });
    const workspaceId = list.body.workspaces[0].workspaceId;

    const detail = await invokeRouter(router, {
      method: "GET",
      url: `/review-workspaces/${encodeURIComponent(workspaceId)}`,
    });

    expect(detail.status).toBe(200);
    expect(detail.headers["x-route-source"]).toBe("governedReviewWorkspaceRoutes.ts");
    expect(detail.body.workspace).toEqual(
      expect.objectContaining({
        workspaceId,
        metadataOnly: true,
        appendOnly: true,
        appendEventSummaries: expect.any(Array),
        persistenceDecision: "contract_only_firestore_deferred",
      })
    );
    expect(JSON.stringify(detail.body)).not.toContain("Bearer-secret");
    expect(JSON.stringify(detail.body)).not.toContain("responseBody");

    const post = await invokeRouter(router, { method: "POST", url: "/review-workspaces" });
    expect(post.status).toBe(404);
  });

  it("returns a safe empty state when no append records exist", async () => {
    const router = (await import("../governedReviewWorkspaceRoutes")).default;
    const res = await invokeRouter(router, { method: "GET", url: "/review-workspaces?limit=50" });

    expect(res.status).toBe(200);
    expect(res.headers["x-route-source"]).toBe("governedReviewWorkspaceRoutes.ts");
    expect(res.body.workspaces).toEqual([]);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        total: 0,
        metadataOnly: true,
        emptyState: expect.stringContaining("No governed review workspace append records"),
      })
    );
    expect(res.body.schema).toEqual(
      expect.objectContaining({
        metadataOnly: true,
        visibilityClass: "admin_support_internal",
        tenantVisible: false,
        landlordVisible: false,
        appendOnly: true,
        mutationControlsEnabled: false,
      })
    );
  });
});
