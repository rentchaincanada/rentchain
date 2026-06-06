import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveLandlordAndTierMock = vi.fn();
const getStripeClientMock = vi.fn();
const stripeNotConfiguredResponseMock = vi.fn(() => ({ ok: false, error: "stripe_not_configured" }));
const isStripeNotConfiguredErrorMock = vi.fn((err: any) => String(err?.code || err?.message || "").trim() === "stripe_not_configured");
const landlordDocGetMock = vi.fn(async () => ({ exists: false, data: () => null }));
const landlordDocSetMock = vi.fn(async () => undefined);
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (header) req.user = JSON.parse(header);
    next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const header = String(req.headers["x-test-user"] || "").trim();
    if (!header) return res.status(401).json({ ok: false, error: "unauthenticated" });
    req.user = JSON.parse(header);
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (!landlordId) return res.status(401).json({ ok: false, error: "Missing landlord context" });
    req.user.landlordId = landlordId;
    next();
  },
}));

vi.mock("../../lib/landlordResolver", () => ({
  resolveLandlordAndTier: resolveLandlordAndTierMock,
}));

vi.mock("../../services/billingService", () => ({
  listRecordsForLandlord: vi.fn(() => []),
}));

vi.mock("../../firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: landlordDocGetMock,
        set: landlordDocSetMock,
      }),
    }),
  },
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: stripeNotConfiguredResponseMock,
  isStripeNotConfiguredError: isStripeNotConfiguredErrorMock,
}));

vi.mock("../../config/screeningConfig", () => ({
  FRONTEND_URL: "http://localhost:5173",
}));

vi.mock("../../billing/screeningPricing", () => ({
  getScreeningPricing: vi.fn(() => ({
    baseAmountCents: 2500,
    scoreAddOnCents: 500,
    expeditedAddOnCents: 700,
  })),
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; headers?: Record<string, string>; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const url = new URL(`http://example.test${options.url}`);
    const req: any = {
      method: options.method,
      url: `${url.pathname}${url.search}`,
      originalUrl: `${url.pathname}${url.search}`,
      path: url.pathname,
      headers: options.headers ?? {},
      body: options.body ?? {},
      query: Object.fromEntries(url.searchParams.entries()),
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
    };
    const res: any = {
      statusCode: 200,
      setHeader: vi.fn(),
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

describe("billingRoutes subscription status", () => {
  beforeEach(() => {
    resolveLandlordAndTierMock.mockReset();
    getStripeClientMock.mockReset();
    stripeNotConfiguredResponseMock.mockClear();
    isStripeNotConfiguredErrorMock.mockClear();
    landlordDocGetMock.mockReset();
    landlordDocSetMock.mockReset();
    getStripeClientMock.mockImplementation(() => {
      throw new Error("not needed in billingRoutes subscription-status test");
    });
    landlordDocGetMock.mockResolvedValue({ exists: false, data: () => null });
    landlordDocSetMock.mockResolvedValue(undefined);
    process.env.STRIPE_PRICE_STARTER_MONTHLY_TEST = "price_test_starter_monthly";
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_live_starter_monthly";
    process.env.STRIPE_SECRET_KEY = "sk_live_test_diagnostic";
    consoleErrorSpy.mockClear();
  });

  it("returns the effective canonical tier from landlord resolution", async () => {
    resolveLandlordAndTierMock.mockResolvedValue({
      tier: "elite",
      landlordIdResolved: "landlord-1",
      landlordDocId: "landlord-1",
      landlordPlanRaw: "enterprise",
      source: "landlordId",
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "starter" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      tier: "elite",
      planId: "elite",
      status: "active",
      isActive: true,
      interval: null,
      renewalDate: null,
      currentPeriodEnd: null,
      statusSource: "plan_tier",
      subscriptionStatusSource: "plan_tier",
    });
  });

  it("returns Stripe-derived subscription status fields without raw Stripe identifiers", async () => {
    resolveLandlordAndTierMock.mockResolvedValue({
      tier: "pro",
      landlordIdResolved: "landlord-1",
      landlordDocId: "landlord-1",
      landlordPlanRaw: "pro",
      source: "landlordId",
    });
    landlordDocGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        plan: "pro",
        stripeCustomerId: "cus_secret_123",
        stripeSubscriptionId: "sub_secret_123",
        subscriptionStatus: "active",
        subscriptionInterval: "yearly",
        currentPeriodEnd: 1_767_225_600_000,
      }),
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      tier: "pro",
      planId: "pro",
      status: "active",
      interval: "year",
      renewalDate: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-01-01T00:00:00.000Z",
      isActive: true,
      statusSource: "stripe_subscription",
    });
    const payload = JSON.stringify(res.body);
    expect(payload).not.toContain("cus_secret_123");
    expect(payload).not.toContain("sub_secret_123");
  });

  it("denies tenant access to billing status", async () => {
    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "tenant-user", tenantId: "tenant-1", role: "tenant" }),
      },
    });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: "Forbidden" });
  });

  it("keeps the compatibility alias route and falls back to the token plan when needed", async () => {
    resolveLandlordAndTierMock.mockResolvedValue({
      tier: undefined,
      landlordIdResolved: "landlord-1",
      landlordDocId: null,
      landlordPlanRaw: null,
      source: "tokenFallback",
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/billing/subscription-status",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "business" }),
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      tier: "elite",
      planId: "elite",
      status: "active",
      isActive: true,
    });
  });

  it("returns a controlled 503 when Stripe checkout hits a connection failure", async () => {
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn(async () => {
            const cause: any = new Error("getaddrinfo ENOTFOUND api.stripe.com");
            cause.name = "Error";
            cause.code = "ENOTFOUND";
            cause.errno = "ENOTFOUND";
            cause.syscall = "getaddrinfo";
            cause.hostname = "api.stripe.com";
            const err: any = new Error("An error occurred with our connection to Stripe.");
            err.name = "StripeConnectionError";
            err.type = "StripeConnectionError";
            err.requestId = "req_checkout_123";
            err.numRetries = 2;
            err.cause = cause;
            throw err;
          }),
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/checkout",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
      body: {
        tier: "starter",
        interval: "monthly",
      },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "checkout_temporarily_unavailable" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[billing/checkout] Stripe request failed",
      expect.objectContaining({
        route: "/checkout",
        operation: "checkout.sessions.create",
        name: "StripeConnectionError",
        type: "StripeConnectionError",
        requestId: "req_checkout_123",
        numRetries: 2,
        stripeEnv: expect.any(String),
        stripeKeyMode: "live",
        transportFailureClass: "dns_resolution_failure",
        errno: "ENOTFOUND",
        syscall: "getaddrinfo",
        hostname: "api.stripe.com",
        causeMessage: "getaddrinfo ENOTFOUND api.stripe.com",
        causeChain: [
          expect.objectContaining({
            code: "ENOTFOUND",
            errno: "ENOTFOUND",
            syscall: "getaddrinfo",
            message: "getaddrinfo ENOTFOUND api.stripe.com",
          }),
        ],
      })
    );
  });

  it("creates checkout sessions through the canonical route with safe compatibility fields", async () => {
    const createMock = vi.fn(async () => ({
      id: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    }));
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: createMock,
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/checkout",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
      body: {
        tier: "starter",
        interval: "monthly",
        featureKey: "billing",
        source: "billing_page",
        redirectTo: "/billing",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
      checkoutUrl: "https://checkout.stripe.test/session",
    });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        payment_method_types: ["card"],
        metadata: expect.objectContaining({
          landlordId: "landlord-1",
          tier: "starter",
          interval: "monthly",
        }),
      })
    );
  });

  it("keeps create-checkout-session as a compatibility alias for stale clients", async () => {
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn(async () => ({
            id: "cs_alias_123",
            url: "https://checkout.stripe.test/alias",
          })),
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/create-checkout-session",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
      body: {
        tier: "starter",
        interval: "monthly",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      sessionId: "cs_alias_123",
      url: "https://checkout.stripe.test/alias",
      checkoutUrl: "https://checkout.stripe.test/alias",
    });
  });

  it("denies tenant access to checkout creation", async () => {
    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/checkout",
      headers: {
        "x-test-user": JSON.stringify({ id: "tenant-user", tenantId: "tenant-1", role: "tenant" }),
      },
      body: {
        tier: "starter",
        interval: "monthly",
      },
    });

    expect(res.status).toBe(403);
    expect(getStripeClientMock).not.toHaveBeenCalled();
  });

  it("returns the same controlled 503 when /subscribe hits the shared Stripe checkout failure path", async () => {
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn(async () => {
            const err: any = new Error("An error occurred with our connection to Stripe.");
            err.name = "StripeConnectionError";
            err.type = "StripeConnectionError";
            err.requestId = "req_subscribe_123";
            err.numRetries = 2;
            throw err;
          }),
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/subscribe",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
      body: {
        planKey: "starter",
        interval: "monthly",
      },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "checkout_temporarily_unavailable" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[billing/checkout] Stripe request failed",
      expect.objectContaining({
        route: "/subscribe",
        operation: "checkout.sessions.create",
        name: "StripeConnectionError",
        type: "StripeConnectionError",
        requestId: "req_subscribe_123",
        numRetries: 2,
      })
    );
  });

  it("returns a controlled 503 when Stripe billing portal hits a connection failure", async () => {
    landlordDocGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        stripeCustomerId: "cus_123",
        email: "owner@example.com",
        name: "Owner",
      }),
    });
    getStripeClientMock.mockReturnValue({
      billingPortal: {
        sessions: {
          create: vi.fn(async () => {
            const err: any = new Error("An error occurred with our connection to Stripe.");
            err.name = "StripeConnectionError";
            err.type = "StripeConnectionError";
            err.requestId = "req_portal_123";
            err.numRetries = 2;
            throw err;
          }),
        },
      },
      customers: {
        create: vi.fn(),
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/portal",
      headers: {
        "x-test-user": JSON.stringify({
          id: "u1",
          landlordId: "landlord-1",
          role: "landlord",
          plan: "starter",
          email: "owner@example.com",
        }),
      },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "billing_portal_temporarily_unavailable" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[billing/portal] Stripe request failed",
      expect.objectContaining({
        route: "/portal",
        operation: "billingPortal.sessions.create",
        name: "StripeConnectionError",
        type: "StripeConnectionError",
        requestId: "req_portal_123",
        numRetries: 2,
      })
    );
  });

  it("captures low-level timeout diagnostics when present on the Stripe error object", async () => {
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          create: vi.fn(async () => {
            const err: any = new Error("An error occurred with our connection to Stripe.");
            err.name = "StripeConnectionError";
            err.type = "StripeConnectionError";
            err.code = "ETIMEDOUT";
            err.errno = "ETIMEDOUT";
            err.syscall = "connect";
            err.host = "api.stripe.com";
            err.port = 443;
            err.detail = "socket timed out before TLS handshake";
            err.headers = {
              authorization: "Bearer secret",
              "content-type": "application/json",
            };
            throw err;
          }),
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "POST",
      url: "/upgrade",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
      body: {
        tier: "starter",
        interval: "monthly",
      },
    });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ ok: false, error: "checkout_temporarily_unavailable" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[billing/checkout] Stripe request failed",
      expect.objectContaining({
        route: "/upgrade",
        operation: "checkout.sessions.create",
        transportFailureClass: "timeout",
        errno: "ETIMEDOUT",
        syscall: "connect",
        host: "api.stripe.com",
        port: "443",
        detail: "socket timed out before TLS handshake",
        headers: {
          "content-type": "application/json",
        },
      })
    );
  });

  it("returns verified checkout session status and syncs the landlord plan", async () => {
    const retrieveMock = vi.fn(async () => ({
      id: "cs_123",
      status: "complete",
      payment_status: "paid",
      customer: "cus_123",
      metadata: {
        landlordId: "landlord-1",
        tier: "pro",
        interval: "monthly",
      },
      subscription: {
        id: "sub_123",
        status: "active",
        metadata: {
          landlordId: "landlord-1",
          tier: "pro",
          interval: "monthly",
        },
        current_period_end: 1_735_689_600,
        items: {
          data: [
            {
              price: {
                id: "price_test_pro_monthly",
                recurring: { interval: "month" },
              },
            },
          ],
        },
      },
    }));
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: retrieveMock,
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/session-status?session_id=cs_123",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
    });

    expect(res.status).toBe(200);
    expect(retrieveMock).toHaveBeenCalledWith("cs_123", { expand: ["subscription"] });
    expect(res.body).toMatchObject({
      ok: true,
      sessionId: "cs_123",
      status: "complete",
      payment_status: "paid",
      customer: "cus_123",
      plan: "pro",
      interval: "monthly",
      subscription_status: "active",
      current_period_end: 1_735_689_600_000,
      plan_updated: true,
    });
    expect(landlordDocSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "pro",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripeCheckoutSessionId: "cs_123",
        subscriptionStatus: "active",
        subscriptionInterval: "monthly",
        currentPeriodEnd: 1_735_689_600_000,
        subscriptionUpdatedAt: expect.any(Number),
      }),
      { merge: true }
    );
  });

  it("returns 404 when the checkout session does not exist", async () => {
    getStripeClientMock.mockReturnValue({
      checkout: {
        sessions: {
          retrieve: vi.fn(async () => {
            const err: any = new Error("No such checkout.session");
            err.statusCode = 404;
            throw err;
          }),
        },
      },
    });

    const router = (await import("../billingRoutes")).default;
    const res = await invokeRouter(router, {
      method: "GET",
      url: "/session-status?session_id=cs_missing",
      headers: {
        "x-test-user": JSON.stringify({ id: "u1", landlordId: "landlord-1", role: "landlord", plan: "free" }),
      },
    });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: "session_not_found" });
  });
});
