import type { Page } from "@playwright/test";

type LegacySmokeUser = {
  id: string;
  email: string;
  role: "landlord";
  landlordId: string;
  permissions: string[];
  approved: boolean;
  plan: "pro";
};

type LegacySmokeApiResponse = {
  status: number;
  body: Record<string, unknown> | Array<Record<string, unknown>>;
};

/**
 * Options for configuring legacy smoke test setup.
 */
export type LegacySmokeSetupOptions = {
  /**
   * Whether to unlock the dev preview gate.
   * When true, sets localStorage["dev_auth_unlocked"] = "1" to bypass the DevAuthGate component.
   * This allows legacy tests to run in dev mode without authentication.
   * @default false
   */
  devPreviewUnlock?: boolean;
  /**
   * Whether to install deterministic auth and narrow API fixtures for protected legacy pages.
   * @default true
   */
  authenticated?: boolean;
};

const legacySmokeUser: LegacySmokeUser = {
  id: "smoke-landlord-user",
  email: "landlord.smoke@rentchain.test",
  role: "landlord",
  landlordId: "smoke-landlord",
  permissions: ["landlord:read"],
  approved: true,
  plan: "pro",
};

function encodeBase64Url(input: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(input), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createLegacySmokeJwt(user: LegacySmokeUser) {
  const header = encodeBase64Url({ alg: "none", typ: "JWT" });
  const payload = encodeBase64Url({
    sub: user.id,
    email: user.email,
    role: user.role,
    actorRole: user.role,
    landlordId: user.landlordId,
    permissions: user.permissions,
    exp: 4102444800,
  });
  return `${header}.${payload}.smoke`;
}

function ok(body: LegacySmokeApiResponse["body"]): LegacySmokeApiResponse {
  return { status: 200, body };
}

function notFound(): LegacySmokeApiResponse {
  return { status: 404, body: { ok: false, error: "NOT_FOUND" } };
}

function legacySmokeApi(path: string, method: string): LegacySmokeApiResponse {
  if (path === "/api/me" || path === "/api/auth/me") {
    return ok({ user: legacySmokeUser });
  }

  if (path === "/api/capabilities") {
    return ok({
      ok: true,
      plan: "pro",
      features: {
        hasTenants: true,
        hasProperties: true,
        hasApplications: true,
        hasTenantAI: true,
        hasPropertyAI: true,
        hasPortfolioAI: true,
        hasOnChainRelay: false,
        hasTenantReports: true,
      },
      ts: "2026-01-01T00:00:00.000Z",
    });
  }

  if (path === "/api/dashboard/summary") {
    return ok({
      ok: true,
      data: {
        kpis: {
          propertiesCount: 1,
          unitsCount: 8,
          tenantsCount: 7,
          openActionsCount: 1,
          delinquentCount: 1,
          screeningsCount: 0,
        },
        rent: {
          month: "2026-01",
          collectedCents: 1480000,
          expectedCents: 1600000,
          delinquentCents: 120000,
        },
        actions: [],
        properties: [
          {
            id: "smoke-property",
            name: "Smoke Portfolio",
            units: 8,
            occupiedUnits: 7,
            occupancyRate: 0.875,
          },
        ],
        events: [],
        leaseNoticeSummary: {
          expiringSoon: 0,
          pendingResponse: 0,
          renewed: 0,
          quitting: 0,
          noResponse: 0,
        },
        portfolioCredibilitySummary: null,
        decisions: [],
      },
    });
  }

  if (path === "/api/dashboard/overview") {
    return ok({
      kpis: {
        totalProperties: 1,
        totalUnits: 8,
        occupancyRate: 0.875,
        monthlyRentRoll: 16000,
        monthlyCollected: 14800,
        monthlyDelinquent: 1200,
      },
      properties: [
        {
          id: "smoke-property",
          name: "Smoke Portfolio",
          city: "Toronto",
          units: 8,
          occupiedUnits: 7,
          occupancyRate: 0.875,
          avgRent: 2000,
          risk: "Low",
        },
      ],
      monthlyRent: 16000,
      occupancyRate: 87.5,
      latePayments: 1,
      portfolioValue: 2400000,
      generatedAt: "2026-01-01T00:00:00.000Z",
      status: "ok",
    });
  }

  if (path === "/api/dashboard/ai-summary") {
    return ok({
      generatedAt: "2026-01-01T00:00:00.000Z",
      snapshot: { properties: [], tenants: [], units: [] },
      aiSummary: {
        healthLabel: "Stable",
        summaryText: "Portfolio is stable for smoke validation.",
        risks: ["One payment requires follow-up"],
        opportunities: ["Review renewal timing"],
        suggestedActions: ["Open portfolio health"],
      },
    });
  }

  if (path === "/api/dashboard/ai-portfolio-summary") {
    return ok({
      summary: "Portfolio is stable for smoke validation.",
      healthScore: 86,
      timeframeLabel: "Current month",
      kpis: {
        occupancyRate: 0.875,
        monthlyRentRoll: 16000,
        monthlyCollected: 14800,
        monthlyDelinquent: 1200,
        collectionRatio: 0.925,
        delinquencyRatio: 0.075,
      },
      trend: { collectionsDirection: "flat", riskDirection: "flat" },
      risks: ["One payment requires follow-up"],
      opportunities: ["Review renewal timing"],
    });
  }

  if (path === "/api/dashboard/portfolio-summary") {
    return ok({
      summary: {
        kpis: {
          totalProperties: 1,
          totalUnits: 8,
          occupancyRate: 0.875,
          monthlyRentRoll: 16000,
          monthlyCollected: 14800,
          monthlyDelinquent: 1200,
        },
        narrative: "Smoke portfolio summary",
      },
    });
  }

  if (method === "GET" && path === "/api/payments") {
    return ok({
      items: [
        {
          id: "smoke-payment",
          canonicalPaymentId: "smoke-payment",
          tenantId: "smoke-tenant",
          propertyId: "smoke-property",
          amount: 2000,
          paidAt: "2026-01-01T00:00:00.000Z",
          method: "bank_transfer",
          status: "paid",
          monthlyRent: 2000,
          dueDate: "2026-01-01",
          source: "payments",
        },
      ],
    });
  }

  return notFound();
}

/**
 * Installs shared setup for legacy frontend smoke tests that need dev preview unlock
 * and protected-route auth without full role-based storage state.
 *
 * This is a simplified alternative to installRoleSmokeHarness for tests that:
 * - Run against legacy landlord smoke surfaces without role matrix coverage
 * - Need to bypass the dev preview gate in development mode
 * - Need deterministic auth and narrow API fixtures without storage state
 *
 * @example
 * ```ts
 * import { installLegacySmokeHarness } from "./legacy-smoke-setup";
 *
 * test("AI drawer loads", async ({ page }) => {
 *   await installLegacySmokeHarness(page, { devPreviewUnlock: true });
 *   await page.goto("/dashboard");
 *   // Test assertions...
 * });
 * ```
 *
 * @param page - Playwright page instance
 * @param options - Setup configuration options
 */
export async function installLegacySmokeHarness(
  page: Page,
  options: LegacySmokeSetupOptions = {}
): Promise<void> {
  const { devPreviewUnlock = false, authenticated = true } = options;

  const token = createLegacySmokeJwt(legacySmokeUser);

  await page.addInitScript(
    ({ shouldUnlock, shouldAuthenticate, appToken }) => {
      if (!shouldUnlock && !shouldAuthenticate) return;

      if (shouldUnlock) {
        window.localStorage.setItem("dev_auth_unlocked", "1");
      }

      if (shouldAuthenticate) {
        window.localStorage.setItem("rentchain_token", appToken);
        window.sessionStorage.setItem("rentchain_token", appToken);
      }
    },
    { shouldUnlock: devPreviewUnlock, shouldAuthenticate: authenticated, appToken: token },
  );

  if (authenticated) {
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/")) {
        await route.fallback();
        return;
      }

      const response = legacySmokeApi(url.pathname, request.method());
      await route.fulfill({
        status: response.status,
        contentType: "application/json",
        body: JSON.stringify(response.body),
      });
    });
  }
}
