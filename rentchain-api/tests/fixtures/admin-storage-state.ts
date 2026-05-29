export type SmokeRole = "admin" | "landlord" | "tenant";

export type SmokeUser = {
  id: string;
  role: SmokeRole;
  email: string;
  permissions: string[];
  landlordId?: string;
  tenantId?: string;
};

export type SmokeProperty = {
  id: string;
  displayLabel: string;
  landlordId: string;
  unitIds: string[];
};

export type SmokeUnit = {
  id: string;
  propertyId: string;
  label: string;
};

export type SmokeTenant = {
  id: string;
  fullName: string;
  email: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
};

export type SmokeLease = {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  status: "active" | "draft";
};

export type SmokeMaintenanceRequest = {
  id: string;
  tenantId: string;
  landlordId: string;
  propertyId: string;
  unitId: string;
  status: "submitted" | "reviewed" | "assigned" | "completed";
  auditTrail: Array<{
    eventId: string;
    action: string;
    actorRole: SmokeRole;
    occurredAt: string;
  }>;
};

export type SmokeAuditEvent = {
  id: string;
  actorId: string;
  actorRole: SmokeRole;
  action: string;
  route: string;
  occurredAt: string;
};

export type AdminStorageStateFixture = {
  fixtureVersion: "authenticated-smoke-v1";
  generatedAt: string;
  users: SmokeUser[];
  properties: SmokeProperty[];
  units: SmokeUnit[];
  tenants: SmokeTenant[];
  leases: SmokeLease[];
  maintenanceRequests: SmokeMaintenanceRequest[];
  auditEvents: SmokeAuditEvent[];
};

export function buildAdminStorageStateFixture(): AdminStorageStateFixture {
  return {
    fixtureVersion: "authenticated-smoke-v1",
    generatedAt: "2026-05-28T00:00:00.000Z",
    users: [
      {
        id: "smoke-admin",
        role: "admin",
        email: "admin.smoke@example.test",
        permissions: ["system.admin"],
      },
      {
        id: "smoke-landlord-a-user",
        role: "landlord",
        email: "landlord.a@example.test",
        permissions: [],
        landlordId: "smoke-landlord-a",
      },
      {
        id: "smoke-landlord-b-user",
        role: "landlord",
        email: "landlord.b@example.test",
        permissions: [],
        landlordId: "smoke-landlord-b",
      },
      {
        id: "smoke-tenant-a-user",
        role: "tenant",
        email: "tenant.a@example.test",
        permissions: [],
        tenantId: "smoke-tenant-a",
      },
    ],
    properties: [
      {
        id: "smoke-property-a",
        displayLabel: "Smoke Property A",
        landlordId: "smoke-landlord-a",
        unitIds: ["smoke-unit-a"],
      },
      {
        id: "smoke-property-b",
        displayLabel: "Smoke Property B",
        landlordId: "smoke-landlord-b",
        unitIds: ["smoke-unit-b"],
      },
    ],
    units: [
      { id: "smoke-unit-a", propertyId: "smoke-property-a", label: "Suite 101" },
      { id: "smoke-unit-b", propertyId: "smoke-property-b", label: "Suite 202" },
    ],
    tenants: [
      {
        id: "smoke-tenant-a",
        fullName: "Tenant Smoke A",
        email: "tenant.a@example.test",
        propertyId: "smoke-property-a",
        unitId: "smoke-unit-a",
        leaseId: "smoke-lease-a",
      },
      {
        id: "smoke-tenant-b",
        fullName: "Tenant Smoke B",
        email: "tenant.b@example.test",
        propertyId: "smoke-property-b",
        unitId: "smoke-unit-b",
        leaseId: "smoke-lease-b",
      },
    ],
    leases: [
      {
        id: "smoke-lease-a",
        tenantId: "smoke-tenant-a",
        propertyId: "smoke-property-a",
        unitId: "smoke-unit-a",
        status: "active",
      },
      {
        id: "smoke-lease-b",
        tenantId: "smoke-tenant-b",
        propertyId: "smoke-property-b",
        unitId: "smoke-unit-b",
        status: "active",
      },
    ],
    maintenanceRequests: [
      {
        id: "smoke-maintenance-a",
        tenantId: "smoke-tenant-a",
        landlordId: "smoke-landlord-a",
        propertyId: "smoke-property-a",
        unitId: "smoke-unit-a",
        status: "submitted",
        auditTrail: [
          {
            eventId: "smoke-maintenance-event-a",
            action: "maintenance_submitted",
            actorRole: "tenant",
            occurredAt: "2026-05-28T01:00:00.000Z",
          },
        ],
      },
      {
        id: "smoke-maintenance-b",
        tenantId: "smoke-tenant-b",
        landlordId: "smoke-landlord-b",
        propertyId: "smoke-property-b",
        unitId: "smoke-unit-b",
        status: "assigned",
        auditTrail: [
          {
            eventId: "smoke-maintenance-event-b",
            action: "maintenance_assigned",
            actorRole: "landlord",
            occurredAt: "2026-05-28T01:05:00.000Z",
          },
        ],
      },
    ],
    auditEvents: [
      {
        id: "smoke-audit-admin-properties",
        actorId: "smoke-admin",
        actorRole: "admin",
        action: "view_properties",
        route: "/api/admin/properties",
        occurredAt: "2026-05-28T01:10:00.000Z",
      },
    ],
  };
}
