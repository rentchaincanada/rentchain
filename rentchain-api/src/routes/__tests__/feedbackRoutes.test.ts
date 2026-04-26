import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveFeedbackResourceScope = vi.fn();
const saveTenantFeedback = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../lib/feedback/resolveFeedbackResourceScope", () => ({
  resolveFeedbackResourceScope,
}));

vi.mock("../../lib/feedback/saveTenantFeedback", () => ({
  saveTenantFeedback,
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      user: options.user ?? null,
      body: options.body ?? {},
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

describe("tenantFeedbackRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveFeedbackResourceScope.mockResolvedValue({
      resourceType: "maintenance",
      resourceId: "maint-1",
      portfolioId: "landlord-1",
    });
    saveTenantFeedback.mockResolvedValue({
      id: "feedback-1",
      createdAt: "2026-04-16T12:00:00.000Z",
    });
  });

  it("submits feedback successfully for a tenant-scoped resource", async () => {
    const router = (await import("../tenantFeedbackRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/feedback",
      user: { id: "tenant-1", tenantId: "tenant-1", role: "tenant", email: "tenant@example.com" },
      body: {
        type: "maintenance_experience",
        resourceType: "maintenance",
        resourceId: "maint-1",
        sentiment: "negative",
        tags: ["slow_response"],
        notes: "Took longer than expected.",
      },
    });

    expect(response.status).toBe(201);
    expect(saveTenantFeedback).toHaveBeenCalled();
    expect(response.body.feedback.id).toBe("feedback-1");
  });

  it("rejects invalid input", async () => {
    const router = (await import("../tenantFeedbackRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/feedback",
      user: { id: "tenant-1", tenantId: "tenant-1", role: "tenant" },
      body: {
        type: "bad_type",
        resourceType: "maintenance",
        resourceId: "maint-1",
        sentiment: "negative",
      },
    });

    expect(response.status).toBe(400);
  });

  it("enforces tenant-only access and resource scope", async () => {
    const router = (await import("../tenantFeedbackRoutes")).default;

    const unauthorized = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/feedback",
      user: { id: "landlord-1", role: "landlord" },
      body: {},
    });
    expect(unauthorized.status).toBe(401);

    resolveFeedbackResourceScope.mockResolvedValueOnce(null);
    const forbidden = await invokeRouter(router, {
      method: "POST",
      url: "/tenant/feedback",
      user: { id: "tenant-1", tenantId: "tenant-1", role: "tenant" },
      body: {
        type: "maintenance_experience",
        resourceType: "maintenance",
        resourceId: "maint-1",
        sentiment: "positive",
      },
    });
    expect(forbidden.status).toBe(403);
  });
});
