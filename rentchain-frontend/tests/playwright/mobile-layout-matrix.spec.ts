import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { reportSmokeFindings } from "./smoke-findings";
import {
  installRoleSmokeHarness,
  requireStorageStateDetailsForRole,
  roleAuthContext,
  type RoleSmokeRole,
} from "./role-smoke-helpers";

type MatrixRole = RoleSmokeRole;

type MatrixRoute = {
  label: string;
  path: string;
  role: MatrixRole;
  shellText?: RegExp[];
};

const matrixViewports = [
  { name: "iphone", size: { width: 390, height: 844 } },
  { name: "android", size: { width: 412, height: 915 } },
  { name: "narrow", size: { width: 360, height: 780 } },
];

const hardenedTenantViewports = [
  { name: "iphone-375", size: { width: 375, height: 812 } },
  { name: "android-360", size: { width: 360, height: 800 } },
  { name: "ipad-768", size: { width: 768, height: 1024 } },
  { name: "narrow-desktop-600", size: { width: 600, height: 900 } },
];

const matrixRoutes: MatrixRoute[] = [
  { role: "tenant", label: "tenant workspace", path: "/tenant", shellText: [/tenant/i, /rentchain tenant/i] },
  { role: "tenant", label: "tenant lease", path: "/tenant/lease", shellText: [/lease/i, /tenant/i] },
  { role: "tenant", label: "tenant ledger", path: "/tenant/ledger", shellText: [/ledger/i, /tenant/i] },
  { role: "tenant", label: "tenant documents", path: "/tenant/documents", shellText: [/documents/i, /tenant/i] },
  { role: "tenant", label: "tenant messages", path: "/tenant/messages", shellText: [/messages/i, /tenant/i] },
  { role: "tenant", label: "tenant profile", path: "/tenant/profile", shellText: [/profile/i, /tenant/i] },
  { role: "tenant", label: "tenant maintenance", path: "/tenant/maintenance", shellText: [/maintenance/i, /tenant/i] },

  { role: "landlord", label: "landlord dashboard", path: "/dashboard", shellText: [/dashboard/i, /portfolio/i] },
  { role: "landlord", label: "landlord properties", path: "/properties", shellText: [/properties/i, /portfolio/i] },
  { role: "landlord", label: "landlord applications", path: "/applications", shellText: [/applications/i, /screening/i] },
  { role: "landlord", label: "landlord decision inbox", path: "/decision-inbox", shellText: [/decision/i, /inbox/i] },
  { role: "landlord", label: "landlord operations", path: "/operations", shellText: [/operations/i, /command/i] },
  { role: "landlord", label: "landlord leases", path: "/leases", shellText: [/leases/i, /active/i] },
  { role: "landlord", label: "landlord payments", path: "/payments", shellText: [/payments/i, /rent/i] },
  { role: "landlord", label: "landlord work orders", path: "/work-orders", shellText: [/work orders/i, /maintenance/i] },
  { role: "landlord", label: "landlord messages", path: "/messages", shellText: [/messages/i, /inbox/i] },

  { role: "admin", label: "admin dashboard", path: "/admin", shellText: [/admin/i, /workspace/i] },
  { role: "admin", label: "admin properties", path: "/admin/properties", shellText: [/properties/i, /workspace/i] },
  { role: "admin", label: "admin tenants", path: "/admin/tenants", shellText: [/tenants/i, /workspace/i] },
  { role: "admin", label: "admin leases", path: "/admin/leases", shellText: [/leases/i, /workspace/i] },
  { role: "admin", label: "admin review workspaces", path: "/admin/review-workspaces", shellText: [/review workspaces/i, /workspace/i] },
  { role: "admin", label: "admin support escalations", path: "/admin/support/escalations", shellText: [/support/i, /escalation/i] },
  { role: "admin", label: "admin security incidents", path: "/admin/security/incidents", shellText: [/security/i, /incident/i] },
  { role: "admin", label: "support operations", path: "/support-operations", shellText: [/support/i, /operations/i] },
];

// Phase 1 Mission 11a covers rendered mobile behavior for hardened tenant surfaces.
// Viewports: iPhone 375px, Android 360px, iPad 768px, narrow desktop 600px.
// Tenant data below uses deterministic safe reference keys and omits raw internal IDs.
const hardenedTenantRoutes: MatrixRoute[] = [
  { role: "tenant", label: "tenant profile continuity", path: "/tenant/profile", shellText: [/profile/i, /verified/i] },
  { role: "tenant", label: "tenant documents continuity", path: "/tenant/documents", shellText: [/documents|attachments|issued items/i] },
  { role: "tenant", label: "tenant payments continuity", path: "/tenant/payments", shellText: [/payments/i, /rent/i] },
  { role: "tenant", label: "tenant messages continuity", path: "/tenant/messages", shellText: [/communications|messages/i] },
  { role: "tenant", label: "tenant notifications continuity", path: "/tenant/activity", shellText: [/recent activity|notifications|feed/i] },
  { role: "tenant", label: "tenant maintenance continuity", path: "/tenant/maintenance", shellText: [/maintenance/i, /request/i] },
];

const rawTenantReferencePatterns = [
  /smoke-tenant-[a-z0-9-]*/i,
  /smoke-property-[a-z0-9-]*/i,
  /smoke-unit-[a-z0-9-]*/i,
  /smoke-lease-[a-z0-9-]*/i,
  /smoke-landlord-[a-z0-9-]*/i,
  /tenant-[0-9a-f-]{6,}/i,
  /property-[0-9a-f-]{6,}/i,
  /lease-[0-9a-f-]{6,}/i,
  /unit-[0-9a-f-]{6,}/i,
];

const safeProjectionMetadata = {
  projectionProfile: {
    projectionName: "tenant_safe_mobile_layout_projection",
    projectionVersion: "mobile-layout-v1",
    audience: "tenant_workspace",
    scopeType: "tenant_mobile_layout",
    allowedSourceCollections: ["tenant_safe_fixture"],
    allowedFieldGroups: ["display", "status", "safe_refs"],
    excludedFieldGroups: ["raw_ids", "storage_paths", "provider_payloads"],
    sensitivityClass: "sensitive",
    authorityBasis: "authenticated_tenant_scope",
    relationshipBasis: "active_tenant",
    internalReferencePolicy: "safe_reference_keys_only",
    redactionPolicy: "redact_internal_identifiers",
  },
  projectionVersion: "mobile-layout-v1",
  sensitivityClass: "sensitive",
  authorityBasis: "authenticated_tenant_scope",
  sourceCollections: ["tenant_safe_fixture"],
  sourceRefs: [{ sourceCollection: "tenant_safe_fixture", sourceId: "fixture-ref-mobile-layout" }],
  redactionSummary: {
    redactionPolicy: "redact_internal_identifiers",
    redactedFieldGroups: ["raw_ids", "storage_paths", "provider_payloads"],
    redactionCount: 6,
  },
};

function selectedRole() {
  const role = String(process.env.QA_ROLE || "mobile").trim().toLowerCase();
  if (role === "landlord" || role === "tenant" || role === "admin") return role;
  return "mobile";
}

function routeSlug(route: MatrixRoute) {
  return `${route.role}-${route.label}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

async function visibleShellText(page: Page, route: MatrixRoute) {
  if (!route.shellText?.length) return false;
  return page.evaluate(
    (patterns) => {
      const text = document.body.innerText || "";
      return patterns.some((pattern) => new RegExp(pattern.source, pattern.flags).test(text));
    },
    route.shellText.map((pattern) => ({ source: pattern.source, flags: pattern.flags })),
  );
}

async function collectMobileLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const visibleElements = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.getAttribute("aria-hidden") !== "true"
      );
    });

    const describe = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const labelSource = element.getAttribute("aria-label") || element.getAttribute("title") || element.dataset.testid;
      const label = labelSource ? labelSource.replace(/\s+/g, " ").trim().slice(0, 60) : element.tagName.toLowerCase();
      return {
        tag: element.tagName.toLowerCase(),
        label,
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    };

    const hasHorizontalScrollContainer = (element: HTMLElement) => {
      let current: HTMLElement | null = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (current.scrollWidth > current.clientWidth + 2 && ["auto", "scroll"].includes(style.overflowX)) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    const oversizedElements = visibleElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > viewportWidth + 2 &&
          style.position !== "fixed" &&
          !["HTML", "BODY", "SVG", "CANVAS"].includes(element.tagName)
        );
      })
      .slice(0, 8)
      .map(describe);

    const fixedOverflowElements = visibleElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.position === "fixed" && (rect.left < -2 || rect.right > viewportWidth + 2);
      })
      .slice(0, 8)
      .map(describe);

    const clippedInteractiveElements = visibleElements
      .filter((element) => element.matches("button, a, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return !hasHorizontalScrollContainer(element) && (rect.left < -2 || rect.right > viewportWidth + 2);
      })
      .slice(0, 8)
      .map(describe);

    return {
      viewportWidth,
      viewportHeight,
      horizontalOverflow,
      oversizedElements,
      fixedOverflowElements,
      clippedInteractiveElements,
    };
  });
}

async function collectHardenedTenantSurfaceMetrics(page: Page) {
  return page.evaluate((rawPatterns) => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const bodyText = document.body.innerText || "";
    const visibleControls = Array.from(
      document.body.querySelectorAll<HTMLElement>("button, input, select, textarea, [role='button']")
    ).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    const describeControl = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        label: (element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder") || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };

    return {
      viewportWidth,
      visibleRawReferences: rawPatterns.filter((pattern) => new RegExp(pattern, "i").test(bodyText)),
      undersizedControls: visibleControls
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return !element.hasAttribute("disabled") && rect.width < 44 && rect.height < 44;
        })
        .slice(0, 8)
        .map(describeControl),
    };
  }, rawTenantReferencePatterns.map((pattern) => pattern.source));
}

function shouldIgnoreHardenedTenantConsoleError(message: string) {
  return (
    /Direct fetch\(\) forbidden for \/api\. Use apiFetch\/apiJson\./i.test(message) ||
    /Each child in a list should have a unique "key" prop/i.test(message)
  );
}

async function installMobileLayoutMatrixOverrides(page: Page) {
  await page.route("**/api/applications**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/applications") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/viewings**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/viewings") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/review-workspaces**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/review-workspaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaces: [],
          summary: {
            total: 0,
            byType: {},
            byStatus: {},
            byAssignment: {},
            appendOnly: true,
            metadataOnly: true,
            emptyState: "No governed review workspaces available.",
          },
          schema: {
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            appendOnly: true,
            persistence: "read_only_if_present",
            mutationControlsEnabled: false,
            rawPayloadAccessEnabled: false,
            createRouteEnabled: false,
            updateRouteEnabled: false,
            deleteRouteEnabled: false,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/support/escalations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/support/escalations") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          escalations: [],
          summary: {
            total: 0,
            highOrCritical: 0,
            awaitingApproval: 0,
            notes: 0,
            metadataOnly: true,
            emptyState: "No support escalations available.",
          },
          schema: {
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            persistence: "read_only_if_present",
            mutationControlsEnabled: false,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/security/incidents**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/security/incidents") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incidents: [],
          summary: {
            total: 0,
            open: 0,
            reviewing: 0,
            highOrCritical: 0,
            metadataOnly: true,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/tenant/workspace", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          invite: {
            id: "invite-ref-mobile-layout",
            shortId: "invite-mobile-layout",
            email: "tenant.a@example.test",
            status: "accepted",
            joinedAt: 1780243200000,
          },
          landlord: { name: "Smoke Landlord A" },
          property: {
            ...safeProjectionMetadata,
            propertyId: "property-ref-mobile-layout",
            street1: "Smoke Property A",
            city: "Halifax",
            province: "NS",
            postalCode: "B3J 0A1",
          },
          unit: { unitId: "unit-ref-mobile-layout", unitNumber: "Suite 101", label: "Suite 101" },
          profile: {
            displayName: "Tenant Smoke A",
            email: "tenant.a@example.test",
            phone: "902-555-0100",
          },
          application: {
            ...safeProjectionMetadata,
            applicationId: "application-ref-mobile-layout",
            status: "approved",
            missingSteps: [],
            nextActions: ["Keep profile details current"],
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
          lease: {
            ...safeProjectionMetadata,
            leaseId: "lease-ref-mobile-layout",
            status: "active",
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            monthlyRent: 210000,
            documentUrl: null,
            paymentReadiness: {
              readinessStatus: "ready_to_configure",
              readinessLabel: "Ready for rent collection",
              readinessDescription: "Rent terms are present in the tenant-safe lease projection.",
              requiredNextAction: "confirm_payment_setup_later",
              rentTerms: {
                rentAmountAvailable: true,
                dueDateAvailable: true,
                leaseDatesAvailable: true,
                tenantLinked: true,
                leaseExecuted: true,
              },
            },
          },
          maintenance: [
            {
              id: "maintenance-ref-kitchen-sink",
              title: "Kitchen sink follow-up",
              status: "submitted",
              priority: "normal",
              category: "plumbing",
              createdAt: 1780243200000,
              updatedAt: 1780243200000,
            },
          ],
          tenantIdentityRecord: null,
          tenantCredibilitySignals: null,
          portableIdentity: null,
          identityTimeline: null,
        },
      }),
    });
  });

  await page.route("**/api/tenant/access", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          summary: { activeGrants: 0, pendingRequests: 0, latestActivityAt: null },
          pendingRequests: [],
          activeAccess: [],
          recentActivity: [],
          guidance: {
            headline: "You can review and manage access you have shared.",
            body: "Access records use safe tenant references in this layout fixture.",
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/communication/summary", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        unreadMessages: 1,
        unreadNotices: 0,
        unreadMaintenanceUpdates: 0,
        unreadScreeningUpdates: 0,
        unreadTotal: 1,
        latestMessagePreview: "Welcome to your tenant communications workspace.",
        latestMessageAt: "2026-05-31T12:00:00.000Z",
      }),
    });
  });

  await page.route("**/api/tenant/profile", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...safeProjectionMetadata,
          profile: {
            displayName: "Tenant Smoke A",
            email: "tenant.a@example.test",
            phone: "902-555-0100",
            authorityLabel: "Active tenant",
            property: {
              ...safeProjectionMetadata,
              propertyId: "property-ref-mobile-layout",
              city: "Halifax",
              province: "NS",
              postalCode: "B3J 0A1",
              unitNumber: "Suite 101",
              unitDisplayLabel: "Suite 101",
            },
            unit: { unitId: "unit-ref-mobile-layout", label: "Suite 101" },
            application: {
              ...safeProjectionMetadata,
              applicationId: "application-ref-mobile-layout",
              status: "approved",
              missingSteps: [],
              nextActions: [],
              createdAt: "2026-05-01T00:00:00.000Z",
              updatedAt: "2026-05-31T00:00:00.000Z",
            },
            lease: {
              ...safeProjectionMetadata,
              leaseId: "lease-ref-mobile-layout",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
              monthlyRent: 210000,
              status: "active",
              documentUrl: null,
            },
          },
          identity: {
            overallStatus: "verified",
            identityVerification: {
              status: "verified",
              label: "Verified",
              note: "Tenant identity is verified for this workspace.",
              updatedAt: "2026-05-31T00:00:00.000Z",
            },
            documentChecklist: [],
            nextSteps: [],
          },
          actions: {
            editableFields: ["displayName", "phone"],
            documentEntry: { available: true, path: "/tenant/documents", label: "Open tenant documents", note: null },
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/lease", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...safeProjectionMetadata,
          leaseId: "lease-ref-mobile-layout",
          propertyLabel: "Smoke Property A",
          unitLabel: "Suite 101",
          status: "active",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          monthlyRent: 210000,
          documentUrl: null,
          leasePdfLabel: "Lease summary",
          leaseDocumentContext: {
            ...safeProjectionMetadata,
            documentUrl: null,
            displayLabel: "Lease summary",
            documentStatus: "available",
            warnings: [],
          },
          scheduleADocumentContext: null,
          leaseExecution: {
            executionStatus: "fully_executed",
            tenantSignatureStatus: "completed",
            landlordSignatureStatus: "completed",
          },
          tenantSignature: { signedAt: "2026-01-01T12:00:00.000Z" },
          paymentReadiness: {
            readinessStatus: "ready_to_configure",
            readinessLabel: "Ready for rent collection",
            readinessDescription: "Rent terms are present in the tenant-safe lease projection.",
            requiredNextAction: "confirm_payment_setup_later",
            rentTerms: {
              rentAmountAvailable: true,
              dueDateAvailable: true,
              leaseDatesAvailable: true,
              tenantLinked: true,
              leaseExecuted: true,
            },
          },
          rentPaymentSummary: {
            paymentRail: { enabled: false, enabledAt: null, processor: null, blockedReason: "not_required" },
            latestPayment: null,
            paymentExperience: { latestStatus: "on_time", history: [] },
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/leases/*/payments", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          paymentRail: { enabled: false, enabledAt: null, processor: null, blockedReason: "not_required" },
          latestPayment: null,
          paymentExperience: { latestStatus: "on_time", history: [] },
        },
      }),
    });
  });

  await page.route("**/api/tenant/ledger", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "ledger-ref-may-rent",
            title: "May rent received",
            type: "payment",
            period: "May 2026",
            description: "Tenant-safe payment record.",
            occurredAt: 1780243200000,
            amountCents: 210000,
            currency: "cad",
          },
        ],
      }),
    });
  });

  await page.route("**/api/tenant/attachments", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        ...safeProjectionMetadata,
        data: [],
        summary: { total: 0, missing: 0, uploaded: 0, pendingReview: 0, verified: 0, needsAttention: 0 },
        guidance: {
          headline: "Your document vault is ready.",
          nextSteps: ["Add documents to your tenant profile when needed."],
          uploadEntryAvailable: true,
          uploadEntryLabel: "Add documents to your profile",
          uploadEntryPath: "/tenant/application",
          supportPath: "/tenant/messages",
          supportLabel: "Message your landlord",
        },
        updatedAt: null,
      }),
    });
  });
}

async function installHardenedTenantSurfaceOverrides(page: Page) {
  await page.route("**/api/tenant/profile", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...safeProjectionMetadata,
          context: {
            authority: "active_tenant",
            propertyId: "property-ref-mobile-layout",
            rc_prop_id: null,
            applicationId: "application-ref-mobile-layout",
            leaseId: "lease-ref-mobile-layout",
            tenantId: "tenant-ref-mobile-layout",
            unitId: "unit-ref-mobile-layout",
            invitedEmail: "tenant.a@example.test",
          },
          profile: {
            displayName: "Tenant Smoke A",
            email: "tenant.a@example.test",
            phone: "902-555-0100",
            authorityLabel: "Active tenant",
            property: {
              ...safeProjectionMetadata,
              propertyId: "property-ref-mobile-layout",
              rc_prop_id: null,
              street1: "Smoke Property A",
              street2: null,
              city: "Halifax",
              province: "NS",
              postalCode: "B3J 0A1",
              unitNumber: "Suite 101",
              unitDisplayLabel: "Suite 101",
              features: ["Managed maintenance"],
            },
            unit: { unitId: "unit-ref-mobile-layout", label: "Suite 101" },
            application: {
              ...safeProjectionMetadata,
              applicationId: "application-ref-mobile-layout",
              status: "approved",
              missingSteps: [],
              nextActions: ["Keep profile details current"],
              createdAt: "2026-05-01T00:00:00.000Z",
              updatedAt: "2026-05-31T00:00:00.000Z",
            },
            lease: {
              ...safeProjectionMetadata,
              leaseId: "lease-ref-mobile-layout",
              startDate: "2026-01-01",
              endDate: "2026-12-31",
              monthlyRent: 210000,
              status: "active",
              documentUrl: null,
            },
          },
          identity: {
            overallStatus: "verified",
            identityVerification: {
              status: "verified",
              label: "Verified",
              note: "Tenant identity is verified for this workspace.",
              updatedAt: "2026-05-31T00:00:00.000Z",
            },
            documentChecklist: [
              { code: "photo_id", label: "Photo ID", status: "verified", nextStep: null },
              { code: "lease", label: "Lease document", status: "verified", nextStep: null },
            ],
            nextSteps: ["Review your profile details before submitting updates."],
          },
          actions: {
            editableFields: ["displayName", "phone"],
            documentEntry: {
              available: true,
              path: "/tenant/documents",
              label: "Open tenant documents",
              note: "Documents are scoped to this tenant workspace.",
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/documents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "document-ref-lease-summary",
            type: "document",
            title: "Lease summary",
            description: "Tenant-safe lease summary for Suite 101.",
            fileUrl: null,
            issuedAt: "2026-05-30T00:00:00.000Z",
          },
          {
            id: "document-ref-maintenance-guide",
            type: "notice",
            title: "Maintenance access guide",
            description: "How to coordinate maintenance access.",
            fileUrl: null,
            issuedAt: "2026-05-29T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/tenant/payments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "payment-ref-may-rent",
            amount: 210000,
            dueDate: "2026-05-01",
            paidAt: "2026-05-01T12:00:00.000Z",
            method: "bank transfer",
            status: "paid",
            notes: "May rent received",
          },
        ],
      }),
    });
  });

  await page.route("**/api/tenant/payments/summary", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          tenantId: "tenant-ref-mobile-layout",
          leaseId: "lease-ref-mobile-layout",
          rentAmount: 210000,
          rentDayOfMonth: 1,
          nextDueDate: "2026-06-01",
          lastPayment: {
            amount: 210000,
            paidAt: "2026-05-01T12:00:00.000Z",
            dueDate: "2026-05-01",
            status: "on_time",
          },
          currentPeriod: {
            periodStart: "2026-05-01",
            periodEnd: "2026-05-31",
            amountDue: 210000,
            amountPaid: 210000,
            status: "on_time",
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/communications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          ...safeProjectionMetadata,
          canSend: true,
          canSendReason: null,
          thread: {
            id: "thread-ref-mobile-layout",
            landlordLabel: "Smoke Landlord A",
            propertyId: "property-ref-mobile-layout",
            unitId: "unit-ref-mobile-layout",
            unreadCount: 1,
            lastMessageAt: "2026-05-31T12:00:00.000Z",
            messages: [
              {
                id: "message-ref-welcome",
                senderRole: "landlord",
                body: "Welcome to your tenant communications workspace.",
                createdAt: "2026-05-31T12:00:00.000Z",
                createdAtMs: 1780243200000,
              },
            ],
          },
        },
      }),
    });
  });

  await page.route("**/api/tenant/communications/read", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/tenant/notifications", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "notification-ref-profile",
            type: "identity",
            title: "Profile verified",
            summary: "Your tenant profile is verified and ready for reuse.",
            createdAt: "2026-05-31T12:00:00.000Z",
            status: "success",
            relatedPath: "/tenant/profile",
            sourceRefs: [
              { sourceType: "profile", referenceKey: "profile-ref-mobile-layout", label: "Profile" },
            ],
            read: false,
            readAt: null,
          },
        ],
      }),
    });
  });

  await page.route("**/api/tenant/maintenance-requests", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: [
          {
            id: "maintenance-ref-kitchen-sink",
            tenantId: "tenant-ref-mobile-layout",
            landlordId: "landlord-ref-mobile-layout",
            propertyId: "property-ref-mobile-layout",
            unitId: "unit-ref-mobile-layout",
            propertyLabel: "Smoke Property A",
            unitLabel: "Suite 101",
            title: "Kitchen sink follow-up",
            description: "Tenant-safe maintenance request summary.",
            category: "plumbing",
            priority: "normal",
            status: "submitted",
            createdAt: 1780243200000,
            updatedAt: 1780243200000,
            read: false,
            readAt: null,
            notifications: { tenant: { requiresAccessConfirmation: false, requiresSignoff: false, requiresReworkAwareness: false } },
          },
        ],
      }),
    });
  });
}

async function runMobileLayoutMatrix(
  page: Page,
  testInfo: TestInfo,
  route: MatrixRoute,
  viewportName: string,
  options: { beforeNavigate?: (page: Page) => Promise<void>; hardenedTenantSurface?: boolean } = {},
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const authDetails = requireStorageStateDetailsForRole(route.role);
  const authContext = roleAuthContext(route.role, authDetails);

  testInfo.annotations.push({
    type: "smoke-mode",
    description: "mobile layout matrix smoke",
  });
  testInfo.annotations.push({
    type: "matrix-role",
    description: route.role,
  });
  testInfo.annotations.push({
    type: "auth-mode",
    description: `authenticated ${route.role} via ${authDetails.source || "storage state"}`,
  });

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await installRoleSmokeHarness(page, authContext);
  await installMobileLayoutMatrixOverrides(page);
  if (options.beforeNavigate) await options.beforeNavigate(page);

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route.label} response status`).toBeLessThan(500);
  }

  await expect(page.locator("body"), `${route.label} body`).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const shellVisible = await visibleShellText(page, route);
  testInfo.annotations.push({
    type: "matrix-shell",
    description: shellVisible ? "matched role-appropriate shell text" : "shell text not visible; route may be unauthenticated or access-gated",
  });
  expect(shellVisible, `${route.label} authenticated shell text; storage state may be expired, wrong role, or route regressed`).toBe(true);

  const metrics = await collectMobileLayoutMetrics(page);
  await testInfo.attach("mobile-layout-metrics", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ route: route.label, viewport: viewportName, ...metrics }, null, 2)),
  });

  expect(metrics.horizontalOverflow, `${route.label} horizontal overflow`).toBeLessThanOrEqual(2);
  expect(metrics.oversizedElements, `${route.label} elements exceeding viewport width`).toEqual([]);
  expect(metrics.fixedOverflowElements, `${route.label} fixed/sticky navigation overflow`).toEqual([]);
  expect(metrics.clippedInteractiveElements, `${route.label} clipped interactive controls`).toEqual([]);

  if (options.hardenedTenantSurface) {
    const hardenedMetrics = await collectHardenedTenantSurfaceMetrics(page);
    await testInfo.attach("hardened-tenant-layout-metrics", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({ route: route.label, viewport: viewportName, ...hardenedMetrics }, null, 2)),
    });
    expect(hardenedMetrics.visibleRawReferences, `${route.label} visible raw internal references`).toEqual([]);
    expect(hardenedMetrics.undersizedControls, `${route.label} undersized enabled controls`).toEqual([]);
  }

  await page.screenshot({
    path: testInfo.outputPath(`${viewportName}-${routeSlug(route)}.png`),
    fullPage: true,
  });

  const ignoreTenantConsoleNoise = route.role === "tenant" || options.hardenedTenantSurface;
  const reportableConsoleErrors = ignoreTenantConsoleNoise
    ? consoleErrors.filter((message) => !shouldIgnoreHardenedTenantConsoleError(message))
    : consoleErrors;
  const ignoredConsoleErrors = ignoreTenantConsoleNoise
    ? consoleErrors.filter(shouldIgnoreHardenedTenantConsoleError)
    : [];

  if (ignoredConsoleErrors.length > 0) {
    await testInfo.attach("hardened-tenant-ignored-console-noise", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify({ route: route.label, viewport: viewportName, ignoredConsoleErrors }, null, 2)),
    });
  }

  await reportSmokeFindings(testInfo, route.label, reportableConsoleErrors, pageErrors, {
    role: route.role,
    routeOrFeature: route.path,
  });
}

const role = selectedRole();
const routes = role === "mobile" ? matrixRoutes : matrixRoutes.filter((route) => route.role === role);

for (const viewport of matrixViewports) {
  test.describe(`mobile layout matrix: ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    for (const route of routes) {
      test(`${route.role}: ${route.label} has contained mobile layout`, async ({ page }, testInfo) => {
        await runMobileLayoutMatrix(page, testInfo, route, viewport.name);
      });
    }
  });
}

test.describe("hardened tenant mobile continuity surfaces", () => {
  const authDetails = requireStorageStateDetailsForRole("tenant");
  test.use({ storageState: authDetails.storageState });

  for (const viewport of hardenedTenantViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of hardenedTenantRoutes) {
        test(`${route.label} renders with contained mobile layout`, async ({ page }, testInfo) => {
          await runMobileLayoutMatrix(page, testInfo, route, viewport.name, {
            beforeNavigate: installHardenedTenantSurfaceOverrides,
            hardenedTenantSurface: true,
          });
        });
      }
    });
  }
});
