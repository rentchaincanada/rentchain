import express from "express";
import fs from "fs";
import path from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { routeSource } from "../src/middleware/routeSource";

type SmokeResult = {
  name: string;
  status: "pass" | "fail";
  error?: string;
};

type InvokeResult = {
  status: number;
  body: any;
  headers: Record<string, string>;
};

const ROUTE_SOURCE = "governedReviewWorkspaceRoutes.ts";
const RESULTS_DIR = path.resolve(__dirname, "../../test-results/governed-workspace-smoke");
const RESULTS_FILE = path.join(RESULTS_DIR, "backend-smoke-results.json");
const results: SmokeResult[] = [];

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

vi.mock("../src/config/firebase", () => ({ db: fakeDb }));
vi.mock("../src/middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ") || !mockUser) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    req.user = mockUser;
    return next();
  },
}));
vi.mock("../src/middleware/requireAuthz", () => ({
  requirePermission: () => (req: any, res: any, next: any) => {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (req.user?.role !== "admin" && !permissions.includes("system.admin")) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return next();
  },
}));

function recordResult(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, status: "pass" });
  } catch (error: any) {
    results.push({ name, status: "fail", error: String(error?.message || error) });
    throw error;
  }
}

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
      relatedWorkspaceLinks: [
        {
          linkId: "raw-link-id-1234567890",
          linkType: "incident_to_review_workspace",
          sourceSummary: {
            kind: "security_incident",
            label: "token secret source",
            category: "tenant-id tenant-raw-id",
            severity: "https://storage.googleapis.com/bucket/raw.pdf",
            state: "metadata_review_ready",
            metadataOnly: true,
            rawIdsIncluded: true,
          },
          targetSummary: {
            kind: "review_workspace",
            label: "Governed workspace",
            category: "security_review",
            severity: "medium",
            state: "landlord-id landlord-raw-id",
            metadataOnly: true,
            rawIdsIncluded: true,
          },
          workflowFamily: "authorization bearer workflow",
          metadataOnly: true,
          visibilityClass: "admin_support_internal",
          tenantVisible: true,
          landlordVisible: true,
          appendCompatible: true,
          mutationControlsEnabled: true,
        },
      ],
    },
  });
}

async function buildApp() {
  const governedReviewWorkspaceRoutes = (await import("../src/routes/governedReviewWorkspaceRoutes")).default;
  const app = express();
  app.use("/api/admin", routeSource(ROUTE_SOURCE), governedReviewWorkspaceRoutes);
  app.use("/api", (_req, res) => {
    res.setHeader("x-route-source", "not-found");
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  });
  return app;
}

async function invokeApp(
  app: express.Express,
  options: { method: string; url: string; user?: Record<string, unknown> | null }
): Promise<InvokeResult> {
  return await new Promise((resolve, reject) => {
    mockUser = Object.prototype.hasOwnProperty.call(options, "user") ? options.user : mockUser;
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      headers: mockUser ? { authorization: "Bearer smoke-token" } : {},
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
      getHeader(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers: this.headers });
        return this;
      },
    };
    app.handle(req, res, (error: any) => {
      if (error) return reject(error);
      resolve({ status: 404, body: { ok: false, error: "NOT_FOUND" }, headers: res.headers });
    });
  });
}

function expectRouteSource(res: InvokeResult) {
  expect(res.headers["x-route-source"]).toBe(ROUTE_SOURCE);
}

function expectPayloadSafe(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain("storage.googleapis.com");
  expect(text).not.toContain("gs://");
  expect(text).not.toContain("token=secret");
  expect(text).not.toContain("Bearer-secret");
  expect(text).not.toContain("responseBody");
  expect(text).not.toContain("tenant-raw");
  expect(text).not.toContain("landlord-raw");
  expect(text).not.toContain("raw-link-id");
  expect(text).not.toContain("authorization bearer");
}

describe("governed review workspace route smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resetFakeDb();
    seedWorkspace();
    mockUser = { id: "admin-1", role: "admin", permissions: ["system.admin"] };
  });

  afterAll(() => {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(
      RESULTS_FILE,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          routeSource: ROUTE_SOURCE,
          pass: results.filter((result) => result.status === "pass").length,
          fail: results.filter((result) => result.status === "fail").length,
          results,
        },
        null,
        2
      )}\n`
    );
  });

  it("returns metadata-only workspace list for admin requests", async () => {
    const app = await buildApp();
    const res = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces?limit=50",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    recordResult("admin list returns safe metadata", () => {
      expect(res.status).toBe(200);
      expectRouteSource(res);
      expect(res.body).toEqual(
        expect.objectContaining({
          ok: true,
          workspaces: expect.any(Array),
          summary: expect.objectContaining({ metadataOnly: true }),
        })
      );
      expect(res.body.workspaces[0]).toEqual(
        expect.objectContaining({
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          metadataOnly: true,
          rawPayloadAccessEnabled: false,
        })
      );
      expectPayloadSafe(res.body);
    });
  });

  it("blocks unauthenticated and non-admin list requests", async () => {
    const app = await buildApp();
    const unauthorized = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces",
      user: null,
    });
    const forbidden = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces",
      user: { id: "landlord-1", role: "landlord", permissions: [] },
    });

    recordResult("list access control returns 401 and 403", () => {
      expect(unauthorized.status).toBe(401);
      expectRouteSource(unauthorized);
      expect(forbidden.status).toBe(403);
      expectRouteSource(forbidden);
    });
  });

  it("returns safe workspace detail and 404 for missing workspace", async () => {
    const app = await buildApp();
    const list = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });
    const workspaceId = list.body.workspaces[0].workspaceId;
    const detail = await invokeApp(app, {
      method: "GET",
      url: `/api/admin/review-workspaces/${encodeURIComponent(workspaceId)}`,
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });
    const missing = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces/missing-workspace",
      user: { id: "admin-1", role: "admin", permissions: ["system.admin"] },
    });

    recordResult("admin detail returns safe metadata and missing returns 404", () => {
      expect(detail.status).toBe(200);
      expectRouteSource(detail);
      expect(detail.body.workspace).toEqual(
        expect.objectContaining({
          workspaceId,
          visibilityClass: "admin_support_internal",
          tenantVisible: false,
          landlordVisible: false,
          appendOnly: true,
        })
      );
      expectPayloadSafe(detail.body);
      expect(missing.status).toBe(404);
      expectRouteSource(missing);
    });
  });

  it("blocks unauthenticated and non-admin detail requests", async () => {
    const app = await buildApp();
    const unauthorized = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces/workspace-1",
      user: null,
    });
    const forbidden = await invokeApp(app, {
      method: "GET",
      url: "/api/admin/review-workspaces/workspace-1",
      user: { id: "tenant-1", role: "tenant", permissions: [] },
    });

    recordResult("detail access control returns 401 and 403", () => {
      expect(unauthorized.status).toBe(401);
      expectRouteSource(unauthorized);
      expect(forbidden.status).toBe(403);
      expectRouteSource(forbidden);
    });
  });
});
