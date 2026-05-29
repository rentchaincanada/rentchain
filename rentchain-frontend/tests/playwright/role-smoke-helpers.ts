import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import type {
  AdminStorageStateFixture,
  SmokeMaintenanceRequest,
  SmokeProperty,
  SmokeRole,
  SmokeTenant,
  SmokeUser,
} from "../../../rentchain-api/tests/fixtures/admin-storage-state";
import { reportSmokeFindings } from "./smoke-findings";

export type RoleSmokeRole = SmokeRole;

export type RoleSmokeRoute = {
  label: string;
  path: string;
  shellText?: RegExp[];
  expectedApiResponse?: {
    urlPattern: RegExp;
    header: string;
    value: string;
  };
};

export type RoleSmokeAuthDetails = {
  mode: "authenticated" | "unauthenticated";
  source?: string;
  storageState?: string;
};

export type RoleAuthContext = {
  role: RoleSmokeRole;
  userId: string;
  email: string;
  storageToken: string;
  appToken: string;
  permissions: string[];
  landlordId: string | null;
  tenantId: string | null;
  fixtureVersion: string;
  storageStatePath: string;
};

export type RoleRouteSmokeOptions = {
  authDetails?: RoleSmokeAuthDetails;
  requireShellText?: boolean;
};

type StorageStateFile = {
  cookies?: Array<{ name?: string; value?: string }>;
  origins?: Array<{
    origin?: string;
    localStorage?: Array<{ name?: string; value?: string }>;
  }>;
};

type SmokeApiResponse = {
  status: number;
  body: Record<string, unknown>;
};

const authDenialText = /access denied|log in|sign in|authentication required|not authorized|unauthorized/i;

export const roleSmokeViewports = [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "mobile", size: { width: 390, height: 844 } },
];

const requireBackendFixture = createRequire(import.meta.url);
requireBackendFixture("../../../rentchain-api/node_modules/ts-node/register/transpile-only");
const { buildAdminStorageStateFixture } = requireBackendFixture(
  "../../../rentchain-api/tests/fixtures/admin-storage-state.ts",
) as {
  buildAdminStorageStateFixture: () => AdminStorageStateFixture;
};

const fixture = buildAdminStorageStateFixture();

function absoluteStorageStatePath(path: string) {
  return resolve(process.cwd(), path);
}

function localStorageValue(storageState: StorageStateFile, key: string) {
  for (const origin of storageState.origins ?? []) {
    const entry = origin.localStorage?.find((item) => item.name === key);
    if (entry?.value) return entry.value;
  }
  return null;
}

function cookieValue(storageState: StorageStateFile, key: string) {
  return storageState.cookies?.find((item) => item.name === key)?.value || null;
}

function encodeBase64Url(input: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(input), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createUnsignedSmokeJwt(user: SmokeUser) {
  const header = encodeBase64Url({ alg: "none", typ: "JWT" });
  const payload = encodeBase64Url({
    sub: user.id,
    email: user.email,
    role: user.role,
    actorRole: user.role,
    landlordId: user.landlordId || null,
    tenantId: user.tenantId || null,
    permissions: user.permissions,
    exp: 4102444800,
  });
  return `${header}.${payload}.smoke`;
}

function userForRole(role: RoleSmokeRole) {
  const user = fixture.users.find((item) => item.role === role);
  if (!user) throw new Error(`Storage fixture is missing a ${role} user`);
  return user;
}

function publicUser(user: SmokeUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    actorRole: user.role,
    landlordId: user.landlordId || null,
    tenantId: user.tenantId || null,
    leaseId: user.tenantId ? fixture.tenants.find((tenant) => tenant.id === user.tenantId)?.leaseId || null : null,
    permissions: user.permissions,
    plan: "pro",
    approved: true,
  };
}

function forbidden(): SmokeApiResponse {
  return { status: 403, body: { ok: false, error: "FORBIDDEN" } };
}

function notFound(): SmokeApiResponse {
  return { status: 404, body: { ok: false, error: "NOT_FOUND" } };
}

function ok(body: Record<string, unknown>): SmokeApiResponse {
  return { status: 200, body: { ok: true, ...body } };
}

function unitForProperty(property: SmokeProperty) {
  return fixture.units.filter((unit) => property.unitIds.includes(unit.id));
}

function tenantForLease(tenant: SmokeTenant) {
  const unit = fixture.units.find((item) => item.id === tenant.unitId);
  const property = fixture.properties.find((item) => item.id === tenant.propertyId);
  return {
    id: tenant.id,
    fullName: tenant.fullName,
    firstName: tenant.fullName.split(" ")[0] || tenant.fullName,
    lastName: tenant.fullName.split(" ").slice(1).join(" ") || null,
    email: tenant.email,
    phone: null,
    landlordId: property?.landlordId || null,
    propertyId: property?.id || null,
    propertyName: property?.displayLabel || null,
    unitId: unit?.id || null,
    unitNumber: unit?.label || null,
    leaseId: tenant.leaseId,
    leaseStatus: "active",
    screeningStatus: "not_required",
    moveInStatus: "ready",
    currentLeaseStartDate: "2026-01-01",
    currentLeaseEndDate: "2026-12-31",
    createdAt: fixture.generatedAt,
    updatedAt: fixture.generatedAt,
    lifecycle: {
      lifecycleState: "active_tenant",
      lifecycleLabel: "Active tenant",
      flags: {
        hasActiveLease: true,
        hasPendingLease: false,
      },
    },
    flags: {
      missingLeaseLink: false,
      missingPropertyLink: false,
      hasScreening: false,
    },
  };
}

function adminPropertyView(property: SmokeProperty) {
  const units = unitForProperty(property);
  return {
    id: property.id,
    displayLabel: property.displayLabel,
    name: property.displayLabel,
    address1: `${property.displayLabel} Address`,
    city: "Halifax",
    province: "NS",
    postalCode: "B3J 0A1",
    ownerUserId: `${property.landlordId}-user`,
    landlordId: property.landlordId,
    ownerDisplayName: property.landlordId.endsWith("-a") ? "Landlord A" : "Landlord B",
    ownerStatusLabel: "Active owner",
    managerUserIds: [],
    unitCount: units.length,
    occupiedUnitCount: units.length,
    vacantUnitCount: 0,
    createdAt: fixture.generatedAt,
    updatedAt: fixture.generatedAt,
    integrity: {
      hasIssues: false,
      orphaned: false,
      missingOwner: false,
    },
  };
}

function landlordPropertyView(property: SmokeProperty) {
  const units = unitForProperty(property);
  return {
    id: property.id,
    name: property.displayLabel,
    addressLine1: `${property.displayLabel} Address`,
    city: "Halifax",
    province: "NS",
    postalCode: "B3J 0A1",
    totalUnits: units.length,
    landlordId: property.landlordId,
    status: "active",
    portfolioStatus: "active",
    createdAt: fixture.generatedAt,
    units: units.map((unit) => ({
      id: unit.id,
      unitNumber: unit.label,
      label: unit.label,
      rent: 210000,
      bedrooms: 1,
      bathrooms: 1,
      sqft: 650,
      status: "occupied",
      occupantName: fixture.tenants.find((tenant) => tenant.unitId === unit.id)?.fullName || null,
    })),
    unitCount: units.length,
    occupiedCount: units.length,
    occupancyRate: 1,
  };
}

function tenantWorkspace(tenant: SmokeTenant) {
  const property = fixture.properties.find((item) => item.id === tenant.propertyId);
  const unit = fixture.units.find((item) => item.id === tenant.unitId);
  const maintenance = fixture.maintenanceRequests.filter((item) => item.tenantId === tenant.id);
  return {
    context: {
      authority: "active_tenant",
      propertyId: property?.id || null,
      rc_prop_id: null,
      applicationId: null,
      leaseId: tenant.leaseId,
      tenantId: tenant.id,
      unitId: unit?.id || null,
      invitedEmail: tenant.email,
    },
    property: {
      propertyId: property?.id || "property",
      rc_prop_id: null,
      street1: property?.displayLabel || "Property",
      street2: null,
      city: "Halifax",
      province: "NS",
      postalCode: "B3J 0A1",
      features: ["Managed maintenance"],
    },
    unit: {
      unitId: unit?.id || null,
      label: unit?.label || "Unit",
    },
    application: null,
    lease: {
      leaseId: tenant.leaseId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: 210000,
      dueDay: 1,
      status: "active",
      documentUrl: null,
      signatureStatus: "signed",
      leasePdfStatus: "available",
      paymentStatus: "paid",
    },
    maintenance: maintenance.map(tenantMaintenanceView),
    communications: [],
    notifications: [],
  };
}

function dashboardSummary(context: RoleAuthContext) {
  const properties = ownedProperties(context).map(landlordPropertyView);
  const tenants = ownedTenants(context);
  return {
    kpis: {
      propertiesCount: properties.length,
      unitsCount: properties.reduce((sum, property) => sum + property.unitCount, 0),
      tenantsCount: tenants.length,
      openActionsCount: 0,
      delinquentCount: 0,
      screeningsCount: 0,
    },
    rent: {
      month: "2026-05",
      collectedCents: 210000,
      expectedCents: 210000,
      delinquentCents: 0,
    },
    actions: [],
    properties,
    events: [],
    decisions: [],
    leaseNoticeSummary: {
      expiringSoon: 0,
      pendingResponse: 0,
      renewed: 0,
      quitting: 0,
      noResponse: 0,
    },
    portfolioCredibilitySummary: null,
  };
}

function landlordActivationSummary() {
  return {
    steps: [
      {
        key: "property",
        title: "Add a property",
        status: "completed",
        description: "Smoke property is available.",
        actionLabel: "View properties",
        actionPath: "/properties",
      },
      {
        key: "unit",
        title: "Add a unit",
        status: "completed",
        description: "Smoke unit is available.",
        actionLabel: "View units",
        actionPath: "/properties",
      },
      {
        key: "applicant",
        title: "Invite a tenant",
        status: "completed",
        description: "Smoke tenant is available.",
        actionLabel: "View tenants",
        actionPath: "/tenants",
      },
    ],
    completedCount: 3,
    totalCount: 3,
    nextStepKey: null,
  };
}

function supportOperationsProfiles() {
  return [
    {
      supportOperationsId: "support_operations:authenticated-smoke-v1",
      status: "stable",
      manualReviewRequired: true,
      autonomousSupportExecutionEnabled: false,
      adminImpersonationEnabled: false,
      generatedAt: fixture.generatedAt,
      summary: {
        totalReferences: 1,
        verifiedReferences: 1,
        partiallyVerifiedReferences: 0,
        blockedReferences: 0,
        unavailableReferences: 0,
        restrictions: 0,
      },
      supportReferences: [],
      onboardingReferences: [],
      credentialingReferences: [],
      incidentReferences: [],
      operationalRiskReferences: [],
      reviewReferences: [],
      evidenceReferences: [],
      auditReferences: [],
      supportRestrictions: [],
      redactions: ["Sensitive support payloads are excluded."],
      blockedReasons: [],
      canonicalEvents: [],
    },
  ];
}

function tenantMaintenanceView(item: SmokeMaintenanceRequest) {
  const property = fixture.properties.find((entry) => entry.id === item.propertyId);
  const unit = fixture.units.find((entry) => entry.id === item.unitId);
  return {
    id: item.id,
    title: "Smoke maintenance request",
    status: item.status,
    propertyLabel: property?.displayLabel || "Property",
    unitLabel: unit?.label || "Unit",
    submittedAt: item.auditTrail[0]?.occurredAt || fixture.generatedAt,
    updatedAt: item.auditTrail.at(-1)?.occurredAt || fixture.generatedAt,
    category: "general",
    priority: "normal",
    description: "Tenant-safe maintenance request summary",
    timeline: item.auditTrail.map((event) => ({
      label: event.action,
      actorRole: event.actorRole,
      occurredAt: event.occurredAt,
    })),
  };
}

function tenantForRole(context: RoleAuthContext) {
  const tenant = context.tenantId ? fixture.tenants.find((item) => item.id === context.tenantId) : null;
  if (!tenant) return null;
  return tenant;
}

function ownedProperties(context: RoleAuthContext) {
  if (context.role === "admin") return fixture.properties;
  if (context.role !== "landlord" || !context.landlordId) return [];
  return fixture.properties.filter((property) => property.landlordId === context.landlordId);
}

function ownedTenants(context: RoleAuthContext) {
  const propertyIds = new Set(ownedProperties(context).map((property) => property.id));
  return fixture.tenants.filter((tenant) => propertyIds.has(tenant.propertyId));
}

function routeSmokeApi(context: RoleAuthContext, path: string, method: string): SmokeApiResponse {
  if (path === "/api/me" || path === "/api/auth/me") {
    return ok({ user: publicUser(userForRole(context.role)) });
  }

  if (path === "/api/dashboard/summary") {
    if (context.role === "tenant") return forbidden();
    return ok({ data: dashboardSummary(context) });
  }

  if (path.startsWith("/api/admin") || path === "/api/audit/events" || path === "/api/maintenanceRequests") {
    if (context.role !== "admin") return forbidden();
    if (path.startsWith("/api/admin/support-operations")) {
      const profiles = supportOperationsProfiles();
      const profile = profiles[0];
      return path === `/api/admin/support-operations/${encodeURIComponent(profile.supportOperationsId)}`
        ? ok({ profile })
        : ok({ profiles });
    }
    if (path.startsWith("/api/admin/properties")) {
      const items = fixture.properties.map(adminPropertyView);
      return ok({ items, page: 1, pageSize: 25, total: items.length, hasMore: false });
    }
    if (path.startsWith("/api/admin/tenants")) {
      const items = fixture.tenants.map(tenantForLease);
      return ok({ items, page: 1, pageSize: 25, total: items.length, hasMore: false });
    }
    if (path.startsWith("/api/admin/leases")) {
      const items = fixture.leases.map((lease) => {
        const tenant = fixture.tenants.find((item) => item.id === lease.tenantId);
        const property = fixture.properties.find((item) => item.id === lease.propertyId);
        const unit = fixture.units.find((item) => item.id === lease.unitId);
        return {
          id: lease.id,
          leaseDisplayLabel: `${property?.displayLabel || "Property"} ${unit?.label || "Unit"}`,
          propertyId: property?.id || null,
          propertyName: property?.displayLabel || null,
          unitId: unit?.id || null,
          unitNumber: unit?.label || null,
          landlordId: property?.landlordId || null,
          landlordDisplayName: property?.landlordId || null,
          tenantIds: tenant ? [tenant.id] : [],
          tenantNames: tenant ? [tenant.fullName] : [],
          status: lease.status,
          monthlyRent: 210000,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          riskGrade: "low",
          createdAt: fixture.generatedAt,
          updatedAt: fixture.generatedAt,
          integrity: { hasIssues: false, duplicateAgreement: false, occupancyMismatch: false },
        };
      });
      return ok({ items, page: 1, pageSize: 25, total: items.length, hasMore: false });
    }
    if (path === "/api/admin/overview") {
      return ok({
        summary: {
          totalProperties: fixture.properties.length,
          totalUnits: fixture.units.length,
          totalTenants: fixture.tenants.length,
          totalLeases: fixture.leases.length,
          activeLeases: fixture.leases.length,
          integrityWarnings: 0,
          orphanRecords: 0,
        },
        activity: {
          recentAdminAccessCount: 1,
          recentHighImpactEvents: [{ key: "audit", label: "view_properties", ts: fixture.generatedAt }],
        },
        integrity: {
          orphanProperties: 0,
          missingOwnerLinks: 0,
          duplicateActiveLeases: 0,
          staleLeasePointers: 0,
          propertyUnitMismatches: 0,
        },
      });
    }
    if (path === "/api/admin/audit" || path === "/api/audit/events") {
      return ok({
        summary: {
          recentAdminActions: fixture.auditEvents.length,
          recentExports: 0,
          recentIntegrityEvents: 0,
          recentSavedFilterActions: 0,
        },
        sections: {
          adminActions: fixture.auditEvents.map((event) => ({
            id: event.id,
            type: event.action,
            label: event.action,
            route: event.route,
            occurredAt: event.occurredAt,
            relatedAdminPath: "/admin/audit",
          })),
          exports: [],
          integrityEvents: [],
          savedFilterActions: [],
        },
        data: fixture.auditEvents.map((event) => ({
          actorRole: event.actorRole,
          action: event.action,
          route: event.route,
          occurredAt: event.occurredAt,
        })),
      });
    }
    if (path === "/api/admin/integrity") {
      return ok({ sections: [], totals: { issueTypes: 0, totalIssues: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0 } });
    }
    if (path.startsWith("/api/admin/saved-filters")) return ok({ items: [] });
    if (path === "/api/maintenanceRequests") {
      return ok({ data: fixture.maintenanceRequests.map(tenantMaintenanceView) });
    }
    return ok({ items: [] });
  }

  if (path.startsWith("/api/landlord")) {
    if (context.role !== "landlord") return forbidden();
    if (path === "/api/landlord/activation") return ok(landlordActivationSummary());
    if (path === "/api/landlord/analytics/transunion-onboarding") {
      return ok({ data: { totals: { started: 0, emailClicked: 0, phoneClicked: 0, alreadyCredentialedClicked: 0, connected: 0 }, conversionRate: null } });
    }
    if (path === "/api/landlord/properties") {
      const items = ownedProperties(context).map(landlordPropertyView);
      return ok({ items, properties: items });
    }
    const propertyMatch = path.match(/^\/api\/landlord\/properties\/([^/]+)$/);
    if (propertyMatch) {
      const property = fixture.properties.find((item) => item.id === propertyMatch[1]);
      if (!property) return notFound();
      if (property.landlordId !== context.landlordId) return forbidden();
      return ok({ property: landlordPropertyView(property) });
    }
    if (path === "/api/landlord/tenants") {
      return ok({ items: ownedTenants(context).map(tenantForLease) });
    }
    if (path === "/api/landlord/maintenance-requests") {
      return ok({ items: fixture.maintenanceRequests.filter((item) => item.landlordId === context.landlordId).map(tenantMaintenanceView) });
    }
    return ok({ items: [] });
  }

  if (path === "/api/properties" || path.startsWith("/api/properties?")) {
    if (context.role === "tenant") return forbidden();
    const items = ownedProperties(context).map(landlordPropertyView);
    return ok({ properties: items, items });
  }

  if (path === "/api/tenants" || path.startsWith("/api/tenants?")) {
    if (context.role === "tenant") return forbidden();
    return ok({ tenants: ownedTenants(context).map(tenantForLease), items: ownedTenants(context).map(tenantForLease) });
  }

  if (path.startsWith("/api/tenant")) {
    if (context.role !== "tenant") return forbidden();
    const tenant = tenantForRole(context);
    if (!tenant) return forbidden();
    if (path === "/api/tenant/me") {
      const workspace = tenantWorkspace(tenant);
      return ok({
        data: {
          tenant: {
            id: tenant.id,
            shortId: tenant.id,
            name: tenant.fullName,
            email: tenant.email,
            joinedAt: Date.parse(fixture.generatedAt),
            status: "Active",
          },
          landlord: { name: "Smoke Landlord A" },
          property: { name: workspace.property.street1 },
          unit: { label: workspace.unit.label },
          lease: {
            status: "Active",
            startDate: Date.parse(String(workspace.lease.startDate)),
            endDate: Date.parse(String(workspace.lease.endDate)),
            rentCents: workspace.lease.monthlyRent,
            currency: "CAD",
          },
        },
      });
    }
    if (path === "/api/tenant/workspace") return ok({ data: tenantWorkspace(tenant) });
    if (path === "/api/tenant/activity" || path === "/api/tenant/ledger" || path === "/api/tenant/attachments" || path === "/api/tenant/notices") {
      return ok({ data: [] });
    }
    if (path === "/api/tenant/screening") return ok({ items: [] });
    if (path === "/api/tenant/lease") {
      const workspace = tenantWorkspace(tenant);
      return ok({ lease: workspace.lease, property: workspace.property, unit: workspace.unit });
    }
    const leaseMatch = path.match(/^\/api\/tenant\/leases\/([^/]+)$/);
    if (leaseMatch) {
      if (leaseMatch[1] !== tenant.leaseId) return forbidden();
      const workspace = tenantWorkspace(tenant);
      return ok({ lease: workspace.lease, property: workspace.property, unit: workspace.unit });
    }
    if (path === "/api/tenant/maintenance-requests") {
      return ok({ data: fixture.maintenanceRequests.filter((item) => item.tenantId === tenant.id).map(tenantMaintenanceView) });
    }
    const maintenanceMatch = path.match(/^\/api\/tenant\/maintenance-requests\/([^/]+)$/);
    if (maintenanceMatch) {
      const item = fixture.maintenanceRequests.find((entry) => entry.id === maintenanceMatch[1]);
      if (!item || item.tenantId !== tenant.id) return forbidden();
      return ok({ data: tenantMaintenanceView(item) });
    }
    if (path.startsWith("/api/tenant/messages")) return ok({ data: { items: [] }, items: [] });
    return ok({ data: tenantWorkspace(tenant), items: [] });
  }

  if (path.startsWith("/api/action-requests") || path.startsWith("/api/action-request-counts")) {
    return ok({ items: [], counts: {} });
  }

  if (path === "/api/applications" || path === "/api/tenant-invites" || path === "/api/referrals") {
    return ok({ items: [], referrals: [] });
  }

  if (method === "GET") return ok({ items: [], data: [], properties: [] });
  return ok({});
}

export function storageStateDetailsForRole(role: RoleSmokeRole): RoleSmokeAuthDetails {
  const roleKey = `QA_${role.toUpperCase()}_STORAGE_STATE`;
  const roleStorageState = process.env[roleKey];
  if (roleStorageState) {
    return {
      mode: "authenticated",
      source: roleKey,
      storageState: roleStorageState,
    };
  }

  if (process.env.QA_STORAGE_STATE) {
    return {
      mode: "authenticated",
      source: "QA_STORAGE_STATE",
      storageState: process.env.QA_STORAGE_STATE,
    };
  }

  return { mode: "unauthenticated" };
}

export function requireStorageStateDetailsForRole(role: RoleSmokeRole): RoleSmokeAuthDetails {
  const details = storageStateDetailsForRole(role);
  if (details.mode !== "authenticated" || !details.storageState) {
    throw new Error(
      `Missing storage state for ${role}. Run npm run storage-state:export in rentchain-api and set QA_${role.toUpperCase()}_STORAGE_STATE.`,
    );
  }
  const path = absoluteStorageStatePath(details.storageState);
  if (!existsSync(path)) {
    throw new Error(`Storage state file for ${role} was not found at ${path}`);
  }
  return details;
}

export function storageStateForRole(role: RoleSmokeRole) {
  return storageStateDetailsForRole(role).storageState;
}

/**
 * Reads role identity from an exported Playwright storage-state file.
 * The file must come from the authenticated smoke fixture export and must not contain production credentials.
 */
export function roleAuthContext(role: RoleSmokeRole, authDetails = requireStorageStateDetailsForRole(role)): RoleAuthContext {
  const storageStatePath = absoluteStorageStatePath(authDetails.storageState || "");
  const storageState = JSON.parse(readFileSync(storageStatePath, "utf8")) as StorageStateFile;
  const userId = localStorageValue(storageState, "smoke:user:id");
  const storedRole = localStorageValue(storageState, "smoke:user:role");
  const email = localStorageValue(storageState, "smoke:user:email");
  const fixtureVersion = localStorageValue(storageState, "smoke:fixture:version");
  const storageToken = cookieValue(storageState, "auth-token");

  if (!userId || storedRole !== role || !email || !fixtureVersion || !storageToken) {
    throw new Error(`Storage state for ${role} is missing expected authenticated smoke keys`);
  }

  const user = userForRole(role);
  return {
    role,
    userId,
    email,
    storageToken,
    appToken: createUnsignedSmokeJwt(user),
    permissions: user.permissions,
    landlordId: user.landlordId || null,
    tenantId: user.tenantId || null,
    fixtureVersion,
    storageStatePath,
  };
}

/**
 * Installs test-only role context and deterministic API fixtures before a smoke page loads.
 * This preserves app source auth boundaries while avoiding live credentials, production data, or external auth calls.
 */
export async function installRoleSmokeHarness(page: Page, context: RoleAuthContext) {
  await page.addInitScript((auth) => {
    window.localStorage.setItem("dev_auth_unlocked", "1");
    window.localStorage.setItem("rentchain_token", auth.appToken);
    window.sessionStorage.setItem("rentchain_token", auth.appToken);
    if (auth.role === "tenant") {
      window.localStorage.setItem("rentchain_tenant_token", auth.appToken);
      window.sessionStorage.setItem("rentchain_tenant_token", auth.appToken);
    }
    window.localStorage.setItem("smoke:user:id", auth.userId);
    window.localStorage.setItem("smoke:user:role", auth.role);
    window.localStorage.setItem("smoke:user:email", auth.email);
    window.localStorage.setItem("smoke:fixture:version", auth.fixtureVersion);
  }, context);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/")) {
      await route.fallback();
      return;
    }
    const response = routeSmokeApi(context, url.pathname, request.method());
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
}

/**
 * Navigates a role to its canonical dashboard without changing auth scope.
 */
export async function navigateToRoleDashboard(page: Page, role: RoleSmokeRole) {
  const path = role === "admin" ? "/admin" : role === "landlord" ? "/dashboard" : "/tenant/dashboard";
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (response) expect(response.status(), `${role} dashboard response`).toBeLessThan(500);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page.locator("body"), `${role} dashboard body`).toBeVisible();
}

/**
 * Confirms a role can reach a frontend route or mocked API endpoint without auth denial.
 */
export async function assertRoleCanAccess(page: Page, url: string, role: RoleSmokeRole) {
  if (url.startsWith("/api/")) {
    const result = await page.evaluate(async (path) => {
      const response = await fetch(path, { headers: { "x-api-client": "web" } });
      return { status: response.status, body: await response.json().catch(() => null) };
    }, url);
    expect(result.status, `${role} can access ${url}`).toBeLessThan(400);
    return result.body;
  }

  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (response) expect(response.status(), `${role} can load ${url}`).toBeLessThan(500);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page.getByText(authDenialText), `${role} allowed route ${url}`).toHaveCount(0);
  return null;
}

/**
 * Confirms a role is blocked from a frontend route or mocked API endpoint outside its authority.
 */
export async function assertRoleCannotAccess(page: Page, url: string, role: RoleSmokeRole) {
  if (url.startsWith("/api/")) {
    const result = await page.evaluate(async (path) => {
      const response = await fetch(path, { headers: { "x-api-client": "web" } });
      return { status: response.status };
    }, url);
    expect(result.status, `${role} cannot access ${url}`).toBe(403);
    return;
  }

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await expect(page.getByText(authDenialText).first(), `${role} blocked from ${url}`).toBeVisible();
}

/**
 * Captures a full-page image for diagnosing a role smoke route without embedding secrets or request payloads.
 */
export async function takeScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`),
    fullPage: true,
  });
}

export function getSmokeFixture() {
  return fixture as AdminStorageStateFixture;
}

export async function runRoleRouteSmoke(
  page: Page,
  testInfo: TestInfo,
  route: RoleSmokeRoute,
  viewportName: string,
  options: RoleRouteSmokeOptions = {},
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const authMode = options.authDetails?.mode || "unauthenticated";

  testInfo.annotations.push({
    type: "auth-mode",
    description:
      authMode === "authenticated"
        ? `authenticated via ${options.authDetails?.source || "storage state"}`
        : "unauthenticated smoke",
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const expectedApiResponse =
    route.expectedApiResponse && authMode === "authenticated"
      ? page
          .waitForResponse((response) => route.expectedApiResponse!.urlPattern.test(response.url()), {
            timeout: 10_000,
          })
          .catch(() => null)
      : null;

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route.label} response status`).toBeLessThan(500);
  }

  await expect(page.locator("body"), `${route.label} body`).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${route.label} horizontal overflow`).toBeLessThanOrEqual(2);

  if (route.expectedApiResponse) {
    if (authMode === "authenticated") {
      const apiResponse = await expectedApiResponse;
      expect(apiResponse, `${route.label} expected API response`).not.toBeNull();
      expect(apiResponse!.status(), `${route.label} API response status`).toBeLessThan(500);
      expect(apiResponse!.headers()[route.expectedApiResponse.header.toLowerCase()]).toBe(
        route.expectedApiResponse.value,
      );
    } else {
      testInfo.annotations.push({
        type: "role-api-header",
        description: "skipped API header assertion because smoke is unauthenticated",
      });
    }
  }

  if (route.shellText?.length) {
    const foundShellText = await Promise.all(
      route.shellText.map(async (pattern) => {
        try {
          await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 1_500 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    testInfo.annotations.push({
      type: "role-shell",
      description: foundShellText.some(Boolean)
        ? "matched role-appropriate shell text"
        : "role shell text not visible; route may be unauthenticated or access-gated",
    });

    if (options.requireShellText) {
      expect(
        foundShellText.some(Boolean),
        `${route.label} authenticated shell text; storage state may be expired, wrong role, or route regressed`,
      ).toBe(true);
    }
  }

  await takeScreenshot(page, testInfo, `${viewportName}-${route.label}`);
  await reportSmokeFindings(testInfo, route.label, consoleErrors, pageErrors);
}
