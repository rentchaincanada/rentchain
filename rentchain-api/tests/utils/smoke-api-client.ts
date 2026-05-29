import type { AdminStorageStateFixture, SmokeUser } from "../fixtures/admin-storage-state";
import { hasAdminScope, resolveSmokeUser } from "./auth-helpers";

export type SmokeResponse = {
  status: number;
  body: any;
};

export type SmokeRequest = {
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

function unauthorized(): SmokeResponse {
  return { status: 401, body: { ok: false, error: "UNAUTHORIZED" } };
}

function forbidden(): SmokeResponse {
  return { status: 403, body: { ok: false, error: "FORBIDDEN" } };
}

function notFound(): SmokeResponse {
  return { status: 404, body: { ok: false, error: "NOT_FOUND" } };
}

function propertyProjection(fixture: AdminStorageStateFixture, propertyId: string) {
  const property = fixture.properties.find((item) => item.id === propertyId);
  if (!property) return null;
  return {
    displayLabel: property.displayLabel,
    unitCount: property.unitIds.length,
  };
}

function tenantProjection(fixture: AdminStorageStateFixture, tenantId: string) {
  const tenant = fixture.tenants.find((item) => item.id === tenantId);
  if (!tenant) return null;
  return {
    fullName: tenant.fullName,
    email: tenant.email,
    leaseStatus: fixture.leases.find((lease) => lease.id === tenant.leaseId)?.status || null,
  };
}

function leaseProjection(fixture: AdminStorageStateFixture, tenantId: string) {
  const tenant = fixture.tenants.find((item) => item.id === tenantId);
  if (!tenant) return null;
  const lease = fixture.leases.find((item) => item.id === tenant.leaseId);
  if (!lease) return null;
  const property = propertyProjection(fixture, lease.propertyId);
  const unit = fixture.units.find((item) => item.id === lease.unitId);
  return {
    ok: true,
    lease: {
      status: lease.status,
      propertyLabel: property?.displayLabel || "Property",
      unitLabel: unit?.label || "Unit",
    },
  };
}

function maintenanceProjection(fixture: AdminStorageStateFixture, item: any) {
  const property = propertyProjection(fixture, item.propertyId);
  return {
    status: item.status,
    propertyLabel: property?.displayLabel || "Property",
    auditTrail: item.auditTrail.map((event: any) => ({
      action: event.action,
      actorRole: event.actorRole,
      occurredAt: event.occurredAt,
    })),
  };
}

function adminRoutes(fixture: AdminStorageStateFixture, user: SmokeUser, request: SmokeRequest): SmokeResponse | null {
  if (
    !request.path.startsWith("/api/admin") &&
    !request.path.startsWith("/api/maintenanceRequests") &&
    request.path !== "/api/audit/events"
  ) {
    return null;
  }
  if (!hasAdminScope(user)) return forbidden();

  if (request.method === "GET" && request.path === "/api/admin/properties") {
    return {
      status: 200,
      body: {
        ok: true,
        items: fixture.properties.map((property) => ({
          displayLabel: property.displayLabel,
          unitCount: property.unitIds.length,
        })),
      },
    };
  }

  if (request.method === "GET" && request.path === "/api/admin/tenants") {
    return {
      status: 200,
      body: {
        ok: true,
        items: fixture.tenants.map((tenant) => tenantProjection(fixture, tenant.id)),
      },
    };
  }

  if (request.method === "GET" && request.path === "/api/maintenanceRequests") {
    return {
      status: 200,
      body: {
        ok: true,
        data: fixture.maintenanceRequests.map((item) => maintenanceProjection(fixture, item)),
      },
    };
  }

  if (request.method === "POST" && request.path.endsWith("/review")) {
    const pathParts = request.path.split("/");
    const maintenanceId = pathParts[pathParts.length - 2];
    const item = fixture.maintenanceRequests.find((entry) => entry.id === maintenanceId);
    if (!item) return notFound();
    return {
      status: 200,
      body: {
        ok: true,
        auditTrail: [
          ...item.auditTrail.map((event) => ({
            action: event.action,
            actorRole: event.actorRole,
            occurredAt: event.occurredAt,
          })),
          {
            action: "admin_reviewed",
            actorRole: "admin",
            occurredAt: "2026-05-28T01:15:00.000Z",
          },
        ],
      },
    };
  }

  if (request.method === "GET" && request.path === "/api/audit/events") {
    return {
      status: 200,
      body: {
        ok: true,
        data: fixture.auditEvents.map((event) => ({
          actorRole: event.actorRole,
          action: event.action,
          route: event.route,
          occurredAt: event.occurredAt,
        })),
      },
    };
  }

  return null;
}

function landlordRoutes(fixture: AdminStorageStateFixture, user: SmokeUser, request: SmokeRequest): SmokeResponse | null {
  if (!request.path.startsWith("/api/landlord")) return null;
  if (user.role !== "landlord" || !user.landlordId) return forbidden();

  if (request.method === "GET" && request.path === "/api/landlord/properties") {
    return {
      status: 200,
      body: {
        ok: true,
        items: fixture.properties
          .filter((property) => property.landlordId === user.landlordId)
          .map((property) => ({
            displayLabel: property.displayLabel,
            unitCount: property.unitIds.length,
          })),
      },
    };
  }

  const propertyMatch = request.path.match(/^\/api\/landlord\/properties\/([^/]+)$/);
  if (request.method === "GET" && propertyMatch) {
    const property = fixture.properties.find((item) => item.id === propertyMatch[1]);
    if (!property) return notFound();
    if (property.landlordId !== user.landlordId) return forbidden();
    return {
      status: 200,
      body: { ok: true, property: propertyProjection(fixture, property.id) },
    };
  }

  return null;
}

function tenantRoutes(fixture: AdminStorageStateFixture, user: SmokeUser, request: SmokeRequest): SmokeResponse | null {
  if (!request.path.startsWith("/api/tenant")) return null;
  if (user.role !== "tenant" || !user.tenantId) return forbidden();

  if (request.method === "GET" && request.path === "/api/tenant/lease") {
    const lease = leaseProjection(fixture, user.tenantId);
    return lease ? { status: 200, body: lease } : notFound();
  }

  const leaseMatch = request.path.match(/^\/api\/tenant\/leases\/([^/]+)$/);
  if (request.method === "GET" && leaseMatch) {
    const tenant = fixture.tenants.find((item) => item.id === user.tenantId);
    if (!tenant || tenant.leaseId !== leaseMatch[1]) return forbidden();
    const lease = leaseProjection(fixture, user.tenantId);
    return lease ? { status: 200, body: lease } : notFound();
  }

  return null;
}

export function createSmokeApiClient(fixture: AdminStorageStateFixture) {
  return {
    request(request: SmokeRequest): SmokeResponse {
      const user = resolveSmokeUser(fixture, request.headers);
      if (!user) return unauthorized();

      if (request.method === "GET" && request.path === "/api/auth/me") {
        return {
          status: 200,
          body: {
            ok: true,
            user: {
              role: user.role,
              permissions: user.permissions,
              landlordScoped: Boolean(user.landlordId),
              tenantScoped: Boolean(user.tenantId),
            },
          },
        };
      }

      return (
        adminRoutes(fixture, user, request) ||
        landlordRoutes(fixture, user, request) ||
        tenantRoutes(fixture, user, request) ||
        notFound()
      );
    },
  };
}
