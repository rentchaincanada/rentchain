import { beforeEach, describe, expect, it, vi } from "vitest";

const readTenantSharePackageByToken = vi.fn();
const requestTenantSharePackageItems = vi.fn();

vi.mock("../../services/tenantPortal/tenantSharePackageService", () => ({
  readTenantSharePackageByToken,
  requestTenantSharePackageItems,
}));

async function invokeRouter(router: any, options: { method: string; url: string; body?: any }) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const path = options.url;
    const token = path.split("/").pop() || "";
    const req: any = {
      method: options.method,
      url: path,
      originalUrl: path,
      path,
      params: { token },
      query: {},
      body: options.body || {},
      headers: {},
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

describe("publicTenantShareRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a safe shared tenant identity package", async () => {
    readTenantSharePackageByToken.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });

    const router = (await import("../publicTenantShareRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/share/share-token-1",
    });

    expect(res.status).toBe(200);
    expect(res.body?.data?.identity?.identityStatus).toBe("ready");
    expect(res.body?.data?.documents).toBeUndefined();
  });

  it("fails closed with 404 when the share package is unavailable", async () => {
    readTenantSharePackageByToken.mockResolvedValue(null);
    const router = (await import("../publicTenantShareRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/share/missing-token",
    });

    expect(res.status).toBe(404);
    expect(res.body?.error).toBe("NOT_FOUND");
  });

  it("stores a sanitized additional-information request without granting access", async () => {
    requestTenantSharePackageItems.mockResolvedValue({
      requestedItems: ["credibility_summary", "documents_summary"],
    });

    const router = (await import("../publicTenantShareRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/share/share-token-1/request",
      body: {
        requestedItems: ["credibility_summary", "unknown_key", "documents_summary"],
      },
    });

    expect(res.status).toBe(200);
    expect(requestTenantSharePackageItems).toHaveBeenCalledWith({
      token: "share-token-1",
      requestedItems: ["credibility_summary", "unknown_key", "documents_summary"],
    });
    expect(res.body?.data?.requestedItems).toEqual(["credibility_summary", "documents_summary"]);
  });
});
