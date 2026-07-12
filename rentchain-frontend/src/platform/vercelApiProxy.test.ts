import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import handler, { buildUpstreamUrl } from "../../api/[...path]";

function createResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    body: "",
    headers,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key.toLowerCase(), value);
    }),
    status: vi.fn(function status(this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function send(this: any, body: string) {
      this.body = body;
      return this;
    }),
    json: vi.fn(function json(this: any, body: unknown) {
      this.body = JSON.stringify(body);
      return this;
    }),
  };
}

describe("Vercel API catch-all proxy", () => {
  const originalApiBase = process.env.VITE_API_BASE_URL;

  beforeEach(() => {
    process.env.VITE_API_BASE_URL = "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalApiBase == null) {
      delete process.env.VITE_API_BASE_URL;
    } else {
      process.env.VITE_API_BASE_URL = originalApiBase;
    }
  });

  it("builds the exact Cloud Run URL for relative app-context API paths", () => {
    expect(
      buildUpstreamUrl(
        {
          url: "/api/landlord/leases/lease-1/renewal-notice-communications?debug=1",
          query: { path: ["landlord", "leases", "lease-1", "renewal-notice-communications"] },
        },
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app",
      ),
    ).toBe(
      "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app/api/landlord/leases/lease-1/renewal-notice-communications?debug=1",
    );
  });

  it("forwards authenticated invalid payloads to Cloud Run instead of returning Vercel Not Found", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(_url).toBe(
        "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app/api/landlord/leases/lease-1/renewal-notice-communications",
      );
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ confirmationAccepted: true }));
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
      return new Response(
        JSON.stringify({ ok: false, error: "RENEWAL_NOTICE_SNAPSHOT_ID_REQUIRED" }),
        {
          status: 400,
          headers: {
            "content-type": "application/json",
            "x-route-source": "leaseNoticeLandlordRoutes.ts",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      url: "/api/landlord/leases/lease-1/renewal-notice-communications",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
        host: "preview.example.vercel.app",
      },
      body: { confirmationAccepted: true },
      query: { path: ["landlord", "leases", "lease-1", "renewal-notice-communications"] },
    };
    const res = createResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toContain("RENEWAL_NOTICE_SNAPSHOT_ID_REQUIRED");
    expect(res.headers.get("x-route-source")).toBe("leaseNoticeLandlordRoutes.ts");
    expect(res.headers.get("x-rentchain-api-proxy")).toBe("vercel-catchall");
  });
});
