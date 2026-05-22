import fs from "fs";
import path from "path";
import express from "express";
import { describe, expect, it, vi } from "vitest";
import { routeSource } from "../../middleware/routeSource";
import {
  requireDiagnosticAccess,
  safeDiagnosticBuildMetadata,
} from "../../middleware/diagnosticSurfaceGuard";

const authState = vi.hoisted(() => ({
  user: null as any,
}));

const stripeMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
}));

function buildEmptyQuery() {
  return {
    where: () => buildEmptyQuery(),
    orderBy: () => buildEmptyQuery(),
    limit: () => buildEmptyQuery(),
    get: async () => ({ docs: [], empty: true, size: 0 }),
  };
}

vi.mock("../../config/firebase", () => ({
  FieldValue: {
    serverTimestamp: () => "server-timestamp",
  },
  db: {
    collection: () => ({
      doc: (id = "doc-1") => ({
        id,
        get: async () => ({ id, exists: false, data: () => null }),
        set: async () => undefined,
      }),
      where: () => buildEmptyQuery(),
      orderBy: () => buildEmptyQuery(),
      limit: () => buildEmptyQuery(),
      get: async () => ({ docs: [], empty: true, size: 0 }),
    }),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    if (authState.user) req.user = authState.user;
    next();
  },
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ") || !authState.user) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    req.user = authState.user;
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const auth = String(req.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    req.user = authState.user || {
      id: "landlord-1",
      landlordId: "landlord-1",
      role: "landlord",
    };
    return next();
  },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../config/screeningConfig", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: stripeMocks.constructEvent,
    },
  }),
  isStripeConfigured: () => true,
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: () => ({ ok: false, error: "stripe_not_configured" }),
  isStripeNotConfiguredError: () => false,
}));

vi.mock("../../services/stripeFinalize", () => ({
  finalizeStripePayment: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeScreeningProcessor", () => ({
  applyScreeningResultsFromOrder: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screening/screeningOrchestrator", () => ({
  beginScreening: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screening/providers/bureauProvider", () => ({
  getBureauProvider: () => ({
    name: "transunion",
    isConfigured: () => true,
  }),
}));

vi.mock("../../storage/pdfStore", () => ({
  putPdfObject: vi.fn(async () => ({ url: "https://example.test/report.pdf" })),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/emailService", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

function appBuildSource() {
  return fs.readFileSync(path.resolve(__dirname, "../../app.build.ts"), "utf8");
}

function publicRoutesSource() {
  return fs.readFileSync(path.resolve(__dirname, "../publicRoutes.ts"), "utf8");
}

async function invokeApp(
  app: any,
  options: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: any; text?: string; headers: Record<string, any> }>(
    (resolve, reject) => {
      const [pathOnly, rawQuery] = options.url.split("?");
      const req: any = {
        method: options.method,
        url: options.url,
        originalUrl: options.url,
        path: pathOnly,
        query: rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery).entries()) : {},
        body: options.body ?? {},
        headers: Object.fromEntries(
          Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
        ),
        cookies: {},
        get(name: string) {
          return this.headers[String(name || "").toLowerCase()];
        },
        header(name: string) {
          return this.headers[String(name || "").toLowerCase()];
        },
      };
      const res: any = {
        statusCode: 200,
        headers: {} as Record<string, any>,
        setHeader(name: string, value: any) {
          this.headers[String(name).toLowerCase()] = value;
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          resolve({ status: this.statusCode, body: payload, headers: this.headers });
          return this;
        },
        send(payload: any) {
          resolve({
            status: this.statusCode,
            body: payload,
            text: Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload ?? ""),
            headers: this.headers,
          });
          return this;
        },
        end(payload?: any) {
          resolve({
            status: this.statusCode,
            body: payload,
            text: Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload ?? ""),
            headers: this.headers,
          });
          return this;
        },
      };

      app.handle(req, res, (error: any) => {
        if (error) reject(error);
        else reject(new Error(`Unhandled request: ${options.method} ${options.url}`));
      });
    }
  );
}

async function buildRuntimeOwnershipApp() {
  const { requireLandlord } = await import("../../middleware/requireLandlord");
  const { handleLeaseDocumentUrl } = await import("../leaseRoutes");
  const messagesRoutes = (await import("../messagesRoutes")).default;
  const landlordEvidencePackRoutes = (await import("../landlordEvidencePackRoutes")).default;
  const internalReportsRoutes = (await import("../internalReportsRoutes")).default;
  const screeningJobsAdminRoutes = (await import("../screeningJobsAdminRoutes")).default;
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  const { transunionWebhookHandler } = await import("../transunionWebhookRoutes");

  const app = express();
  app.post("/api/webhooks/stripe", routeSource("stripeScreeningOrdersWebhookRoutes.ts"), stripeWebhookHandler);
  app.post("/api/webhooks/transunion", routeSource("transunionWebhookRoutes.ts"), transunionWebhookHandler);
  app.get("/api/leases/:leaseId/document-url", routeSource("leaseRoutes.ts"), requireLandlord, handleLeaseDocumentUrl);
  app.use("/api", routeSource("messagesRoutes.ts"), messagesRoutes);
  app.use("/api/landlord", routeSource("landlordEvidencePackRoutes.ts"), landlordEvidencePackRoutes);
  app.use("/api/internal", routeSource("internalReportsRoutes.ts"), internalReportsRoutes);
  app.get("/api/__probe/revision", routeSource("app.build.ts:/api/__probe/revision"), (_req, res) =>
    res.json({
      ok: true,
      ...safeDiagnosticBuildMetadata({
        K_SERVICE: "rentchain-api",
        K_REVISION: "rev-1",
        GIT_SHA: "sha-1",
      } as NodeJS.ProcessEnv),
    })
  );
  app.get("/api/__debug/build", requireDiagnosticAccess("app.build.ts:/api/__debug/build"), (_req, res) =>
    res.json({ ok: true, routeCheck: { landlordApplicationLinksMounted: true } })
  );
  app.post("/api/_echo", requireDiagnosticAccess("app.build.ts:/api/_echo"), (req, res) =>
    res.json({ ok: true, method: "POST", body: req.body ?? null })
  );
  app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);
  app.use("/api", (_req, res) => {
    res.setHeader("x-route-source", "not-found");
    return res.status(404).json({ ok: false, code: "NOT_FOUND", error: "Not Found" });
  });
  return app;
}

describe("API route ownership regression", () => {
  it("keeps provider webhooks mounted before the JSON parser", () => {
    const source = appBuildSource();
    const jsonParserIndex = source.indexOf("const jsonParser = express.json");

    expect(source.indexOf('"/api/webhooks/stripe"')).toBeGreaterThan(-1);
    expect(source.indexOf('"/api/stripe/webhook"')).toBeGreaterThan(-1);
    expect(source.indexOf('"/api/webhooks/transunion"')).toBeGreaterThan(-1);
    expect(source.indexOf('"/api/webhooks/stripe"')).toBeLessThan(jsonParserIndex);
    expect(source.indexOf('"/api/stripe/webhook"')).toBeLessThan(jsonParserIndex);
    expect(source.indexOf('"/api/webhooks/transunion"')).toBeLessThan(jsonParserIndex);
  });

  it("keeps high-risk prefixed mounts ahead of broad fallback and screening job routes", () => {
    const source = appBuildSource();
    const ledgerMount = source.indexOf('app.use("/api/ledger", routeSource("ledgerRoutes.ts"), ledgerRoutes)');
    const decisionsMount = source.indexOf('app.use("/api/decisions", routeSource("decisionRoutes.ts"), decisionRoutes)');
    const leaseDocumentUrlRoute = source.indexOf(
      'app.get("/api/leases/:leaseId/document-url", routeSource("leaseRoutes.ts"), requireLandlord, handleLeaseDocumentUrl)'
    );
    const leasesMount = source.indexOf('app.use("/api/leases", routeSource("leaseRoutes.ts"), leaseRoutes)');
    const tenantsMount = source.indexOf('app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes)');
    const screeningJobsMount = source.indexOf('app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes)');
    const apiCatchall = source.indexOf('app.use("/api", (_req, res) => {');

    expect(ledgerMount).toBeGreaterThan(-1);
    expect(decisionsMount).toBeGreaterThan(-1);
    expect(leaseDocumentUrlRoute).toBeGreaterThan(-1);
    expect(leasesMount).toBeGreaterThan(-1);
    expect(tenantsMount).toBeGreaterThan(-1);
    expect(screeningJobsMount).toBeGreaterThan(-1);
    expect(apiCatchall).toBeGreaterThan(-1);
    expect(ledgerMount).toBeLessThan(screeningJobsMount);
    expect(decisionsMount).toBeLessThan(screeningJobsMount);
    expect(leaseDocumentUrlRoute).toBeLessThan(screeningJobsMount);
    expect(leasesMount).toBeLessThan(screeningJobsMount);
    expect(tenantsMount).toBeLessThan(screeningJobsMount);
    expect(screeningJobsMount).toBeLessThan(apiCatchall);
  });

  it("documents public-safe probes, gated diagnostics, and catchall route sources", () => {
    const source = appBuildSource();
    const publicSource = publicRoutesSource();
    const echoRoutes = source.match(/app\.post\(\s*"\/api\/_echo"/g) || [];

    expect(source).toMatch(/app\.get\(\s*"\/api\/__probe\/revision"/);
    expect(source).toMatch(/app\.get\(\s*"\/api\/__probe\/routes"/);
    expect(source).toMatch(/app\.get\(\s*"\/api\/__debug\/build"/);
    expect(source).toMatch(/app\.get\(\s*"\/api\/__debug\/ping-application-links"/);
    expect(source).toContain('safeDiagnosticBuildMetadata()');
    expect(source).toContain('requireDiagnosticAccess("app.build.ts:/api/__routes")');
    expect(source).toContain('requireDiagnosticAccess("app.build.ts:/api/__probe/routes")');
    expect(source).toContain('requireDiagnosticAccess("app.build.ts:/api/_echo")');
    expect(source).toContain('requireDiagnosticAccess("app.build.ts:/api/__debug/build")');
    expect(source).toContain('requireDiagnosticAccess("debugPingApplicationLinks")');
    expect(publicSource).toContain('requireDiagnosticAccess("publicRoutes.ts:/__probe/onboarding-route")');
    expect(publicSource).toContain('requireDiagnosticAccess("publicRoutes.ts:/__probe/routes-lite")');
    expect(publicSource).toContain("safeDiagnosticBuildMetadata()");
    expect(echoRoutes).toHaveLength(1);
    expect(source).toContain('res.setHeader("x-route-source", "not-found")');
  });

  it("routes protected tenant, evidence, and internal endpoints to their owners before rejecting missing credentials", async () => {
    authState.user = null;
    const app = await buildRuntimeOwnershipApp();

    const tenantRes = await invokeApp(app, { method: "GET", url: "/api/tenant/messages/conversation" });
    expect(tenantRes.status).toBe(401);
    expect(tenantRes.headers["x-route-source"]).toBe("messagesRoutes.ts");

    const evidenceRes = await invokeApp(app, {
      method: "GET",
      url: "/api/landlord/evidence-packs/preview?scope=lease&scopeId=lease-1",
    });
    expect(evidenceRes.status).toBe(401);
    expect(evidenceRes.headers["x-route-source"]).toBe("landlordEvidencePackRoutes.ts");

    const internalRes = await invokeApp(app, {
      method: "POST",
      url: "/api/internal/reports/tu-referrals",
      body: {},
    });
    expect(internalRes.status).toBe(401);
    expect(internalRes.headers["x-route-source"]).toBe("internalReportsRoutes.ts");
  });

  it("keeps lease document URL refresh owned by lease routes before screening job fallback", async () => {
    authState.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    const app = await buildRuntimeOwnershipApp();

    const res = await invokeApp(app, {
      method: "GET",
      url: "/api/leases/lease-missing/document-url",
      headers: { authorization: "Bearer landlord-token" },
    });

    expect(res.status).toBe(404);
    expect(res.headers["x-route-source"]).toBe("leaseRoutes.ts");
    expect(res.headers["x-route-source"]).not.toBe("screeningJobsAdminRoutes.ts");
    expect(res.body?.error).not.toBe("Not Found");
  });

  it("keeps webhook requests public and owned by webhook routers", async () => {
    stripeMocks.constructEvent.mockReset();
    stripeMocks.constructEvent.mockReturnValueOnce({
      type: "noop.event",
      data: { object: {} },
    });
    const app = await buildRuntimeOwnershipApp();

    const stripeRes = await invokeApp(app, {
      method: "POST",
      url: "/api/webhooks/stripe",
      headers: {
        "stripe-signature": "t=1,v1=test",
        "content-type": "application/json",
      },
      body: Buffer.from('{"id":"evt_1","type":"noop.event"}'),
    });
    expect(stripeRes.status).toBe(200);
    expect(stripeRes.headers["x-route-source"]).toBe("stripeScreeningOrdersWebhookRoutes.ts");
    expect(stripeMocks.constructEvent).toHaveBeenCalledWith(
      expect.any(Buffer),
      "t=1,v1=test",
      "whsec_test"
    );

    const transunionRes = await invokeApp(app, {
      method: "POST",
      url: "/api/webhooks/transunion",
      headers: {
        "content-type": "application/json",
      },
      body: Buffer.from("{}"),
    });
    expect(transunionRes.status).toBe(400);
    expect(transunionRes.body).toMatchObject({ ok: false, error: "missing_request_id" });
    expect(transunionRes.headers["x-route-source"]).toBe("transunionWebhookRoutes.ts");
  });

  it("keeps public-safe probes, gated diagnostics, and API catchall deterministic", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalInternalToken = process.env.INTERNAL_JOB_TOKEN;
    process.env.NODE_ENV = "production";
    process.env.INTERNAL_JOB_TOKEN = "secret-token";

    try {
      const app = await buildRuntimeOwnershipApp();

      const revision = await invokeApp(app, { method: "GET", url: "/api/__probe/revision" });
      expect(revision.status).toBe(200);
      expect(revision.headers["x-route-source"]).toBe("app.build.ts:/api/__probe/revision");
      expect(revision.body).toMatchObject({
        ok: true,
        service: "rentchain-api",
        revisionPresent: true,
        commitPresent: true,
      });
      expect(JSON.stringify(revision.body)).not.toContain("rev-1");
      expect(JSON.stringify(revision.body)).not.toContain("sha-1");

      const debugDenied = await invokeApp(app, { method: "GET", url: "/api/__debug/build" });
      expect(debugDenied.status).toBe(404);
      expect(debugDenied.headers["x-route-source"]).toBe("app.build.ts:/api/__debug/build");
      expect(debugDenied.body).toEqual({ ok: false, code: "NOT_FOUND", error: "Not Found" });

      const echoDenied = await invokeApp(app, { method: "POST", url: "/api/_echo", body: { token: "secret" } });
      expect(echoDenied.status).toBe(404);
      expect(echoDenied.headers["x-route-source"]).toBe("app.build.ts:/api/_echo");
      expect(JSON.stringify(echoDenied.body)).not.toContain("secret");

      const debugAllowed = await invokeApp(app, {
        method: "GET",
        url: "/api/__debug/build",
        headers: { "x-internal-job-token": "secret-token" },
      });
      expect(debugAllowed.status).toBe(200);
      expect(debugAllowed.body).toMatchObject({ ok: true, routeCheck: { landlordApplicationLinksMounted: true } });

      const echoAllowed = await invokeApp(app, {
        method: "POST",
        url: "/api/_echo",
        body: { ok: true },
        headers: { "x-internal-job-token": "secret-token" },
      });
      expect(echoAllowed.status).toBe(200);
      expect(echoAllowed.body).toMatchObject({ ok: true, method: "POST", body: { ok: true } });

      const missing = await invokeApp(app, { method: "GET", url: "/api/unknown-route" });
      expect(missing.status).toBe(404);
      expect(missing.headers["x-route-source"]).toBe("not-found");
      expect(missing.body).toEqual({ ok: false, code: "NOT_FOUND", error: "Not Found" });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalInternalToken == null) delete process.env.INTERNAL_JOB_TOKEN;
      else process.env.INTERNAL_JOB_TOKEN = originalInternalToken;
    }
  });
});
