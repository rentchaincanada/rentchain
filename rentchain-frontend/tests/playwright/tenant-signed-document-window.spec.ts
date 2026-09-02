import { expect, test, type Route } from "@playwright/test";

const localApiOrigin = "https://local-api.rentchain.test";
const signedDocumentUrl = "https://signed-document.test/authorized-document";

const syntheticTenantToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  Buffer.from(JSON.stringify({ exp: 4_102_444_800, role: "tenant", sub: "window-contract-tenant" })).toString("base64url"),
  "synthetic",
].join(".");

const workspace = {
  context: {
    authority: "active_tenant",
    propertyId: "window-contract-property",
    rc_prop_id: null,
    applicationId: null,
    leaseId: "window-contract-lease",
    tenantId: "window-contract-tenant",
    unitId: "window-contract-unit",
    invitedEmail: "window-contract-tenant@example.invalid",
  },
  property: {
    propertyId: "window-contract-property",
    rc_prop_id: null,
    street1: "Window Contract Property",
    street2: null,
    city: "Halifax",
    province: "NS",
    postalCode: "B3J 0A1",
    features: [],
  },
  unit: { unitId: "window-contract-unit", label: "Suite Test" },
  application: null,
  lease: null,
  maintenance: [],
};

const leaseProjection = {
  leaseId: "window-contract-lease",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRent: 1800,
  status: "active",
  documentUrl: "https://signed-document.test/projected-document",
  leaseDocumentContext: {
    leaseId: "window-contract-lease",
    documentUrl: "https://signed-document.test/projected-document",
    displayLabel: "Signed lease document",
    documentStatus: "signed",
    source: "leaseDocument",
    confidence: "high",
    warnings: [],
  },
  scheduleADocumentContext: null,
  signatureStatus: "signed",
  signingLifecycleState: "signed",
  signingExecutionState: "active",
  signedDocumentState: "available",
  signedDocumentAvailable: true,
  viewSignedDocumentAllowed: true,
  signatureReadinessLabel: "Lease signing complete",
  signatureReadinessDescription: "The canonical signing workflow is complete.",
  tenantSignature: {
    signedAt: "2026-01-02T12:00:00.000Z",
    signatureMethod: "typed",
    signatureDisplayName: "Synthetic Tenant",
  },
  leasePdfStatus: "available",
  leasePdfLabel: "Lease document available",
  leasePdfDescription: "A tenant-safe lease document is available.",
  leaseExecution: {
    executionStatus: "fully_executed",
    executionLabel: "Lease fully executed",
    executionDescription: "The canonical execution flow is complete.",
    requiredNextAction: "none",
    tenantSignatureStatus: "completed",
    landlordSignatureStatus: "completed",
    pdfStatus: "generated",
    completedAt: "2026-01-02T12:00:00.000Z",
  },
};

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

test.describe("tenant signed-document window contract", () => {
  test.use({ serviceWorkers: "block" });

  test("keeps one real WindowProxy, isolates its opener, and navigates it without a referrer", async ({
    baseURL,
    context,
    page,
  }) => {
    if (!baseURL) throw new Error("Local frontend base URL is required for the window contract test.");
    const appUrl = new URL(baseURL);
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (appUrl.protocol !== "http:" || !loopbackHosts.has(appUrl.hostname)) {
      throw new Error("The window contract test is restricted to a local loopback frontend.");
    }
    const appOrigin = appUrl.origin;
    let authorizationRequestCount = 0;
    let destinationRequestCount = 0;
    let destinationReferer: string | null = null;
    let releaseAuthorization!: () => void;
    const authorizationGate = new Promise<void>((resolve) => {
      releaseAuthorization = resolve;
    });

    await page.addInitScript((token) => {
      window.localStorage.setItem("rentchain_token", token);
      window.sessionStorage.setItem("rentchain_token", token);
      window.localStorage.setItem("rentchain_tenant_token", token);
      window.sessionStorage.setItem("rentchain_tenant_token", token);
    }, syntheticTenantToken);

    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === appOrigin) {
        await route.fallback();
        return;
      }

      if (requestUrl.origin === localApiOrigin) {
        if (requestUrl.pathname === "/api/me" || requestUrl.pathname === "/api/auth/me") {
          await fulfillJson(route, {
            user: {
              id: "window-contract-user",
              email: "window-contract-tenant@example.invalid",
              role: "tenant",
              actorRole: "tenant",
              tenantId: "window-contract-tenant",
              leaseId: "window-contract-lease",
            },
          });
          return;
        }
        if (requestUrl.pathname === "/api/tenant/workspace") {
          await fulfillJson(route, { ok: true, data: workspace });
          return;
        }
        if (requestUrl.pathname === "/api/tenant/lease") {
          await fulfillJson(route, { ok: true, data: leaseProjection });
          return;
        }
        if (requestUrl.pathname === "/api/tenant/lease/document-url") {
          authorizationRequestCount += 1;
          await authorizationGate;
          await fulfillJson(route, {
            ok: true,
            data: {
              documentUrl: signedDocumentUrl,
              displayLabel: "Signed lease document",
              documentStatus: "signed",
              source: "leaseDocument",
              expiresInSeconds: 1800,
            },
          });
          return;
        }
        if (/^\/api\/tenant\/leases\/[^/]+\/payments$/.test(requestUrl.pathname)) {
          await fulfillJson(route, {
            ok: true,
            data: {
              paymentRail: { enabled: false, enabledAt: null, processor: null, blockedReason: null },
              latestPayment: null,
              paymentExperience: {
                history: [],
                latestStatus: null,
                retryAvailable: false,
                receiptSummary: {
                  available: false,
                  label: "No payment summary available yet",
                  amountCents: null,
                  paidAt: null,
                  leaseReference: null,
                },
              },
            },
          });
          return;
        }
        await fulfillJson(route, { ok: true, data: [], items: [] });
        return;
      }

      if (requestUrl.href === signedDocumentUrl) {
        destinationRequestCount += 1;
        destinationReferer = route.request().headers().referer ?? null;
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>Authorized synthetic document</title>",
        });
        return;
      }

      await route.abort("blockedbyclient");
    });

    await page.goto("/tenant/lease", { waitUntil: "domcontentloaded" });
    const openDocument = page.getByRole("button", { name: "View signed document" });
    await expect(openDocument).toBeVisible();

    let popupCount = 0;
    page.on("popup", () => {
      popupCount += 1;
    });
    const popupPromise = page.waitForEvent("popup");
    await openDocument.click();
    const reservedPage = await popupPromise;

    await expect.poll(() => authorizationRequestCount).toBe(1);
    expect(reservedPage.url()).toBe("about:blank");
    expect(await reservedPage.evaluate(() => window.opener === null)).toBe(true);
    expect(popupCount).toBe(1);

    releaseAuthorization();
    await reservedPage.waitForURL(signedDocumentUrl);

    expect(destinationRequestCount).toBe(1);
    expect(destinationReferer).toBeNull();
    expect(await reservedPage.evaluate(() => window.opener === null)).toBe(true);
    expect(popupCount).toBe(1);
    expect(context.pages()).toHaveLength(2);
  });
});
