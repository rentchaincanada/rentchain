import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, any>;

const collections = vi.hoisted(() => new Map<string, Map<string, StoredDoc>>());
const fakeDb = vi.hoisted(() => ({
  collection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    const collection = collections.get(name)!;
    return {
      doc(id?: string) {
        const docId = id || `test_doc_${collection.size + 1}`;
        return {
          id: docId,
          async get() {
            return {
              id: docId,
              exists: collection.has(docId),
              data: () => collection.get(docId),
            };
          },
          async set(data: StoredDoc) {
            collection.set(docId, data);
          },
          async create(data: StoredDoc) {
            if (collection.has(docId)) throw new Error("already_exists");
            collection.set(docId, data);
          },
        };
      },
      async get() {
        return {
          docs: Array.from(collection.entries()).map(([id, data]) => ({
            id,
            exists: true,
            data: () => data,
          })),
        };
      },
    };
  },
}));

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

function readCollection(name: string): StoredDoc[] {
  return Array.from((collections.get(name) || new Map()).values());
}

function writeCollectionDoc(name: string, id: string, data: StoredDoc) {
  if (!collections.has(name)) collections.set(name, new Map());
  collections.get(name)!.set(id, data);
}

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: Record<string, unknown> }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      body: options.body || {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
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

const companyAdminUser = { id: "company-admin-1", role: "property_manager_company", email: "admin@elite.example" };
const companyOwnerUser = { id: "company-owner-1", role: "property_manager_company", email: "owner@elite.example" };
const companyStaffUser = { id: "company-staff-1", role: "property_manager_company", email: "staff@elite.example" };
const otherCompanyAdminUser = { id: "company-admin-2", role: "property_manager_company", email: "admin@other.example" };

const validAssignmentBody = {
  relationshipId: "relationship-active",
  staffUserId: "company-staff-1",
  staffRole: "property_manager",
  propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
  workspaceScopes: ["dashboard"],
};

function seedMembership(overrides: Partial<StoredDoc> = {}) {
  const membership = {
    membershipId: overrides.membershipId || `pm-membership-${readCollection("propertyManagerCompanyMemberships").length + 1}`,
    companyId: "pm-company-1",
    userId: "company-admin-1",
    role: "company_admin",
    status: "active",
    invitedByUserId: "company-owner-1",
    createdByUserId: "company-owner-1",
    createdAt: "2026-06-24T00:30:00.000Z",
    updatedAt: "2026-06-24T00:30:00.000Z",
    suspendedAt: null,
    suspendedByUserId: null,
    removedAt: null,
    removedByUserId: null,
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanyMemberships", membership.membershipId, membership);
  return membership;
}

function seedRelationship(overrides: Partial<StoredDoc> = {}) {
  const relationship = {
    relationshipId: overrides.relationshipId || "relationship-active",
    landlordId: "landlord-1",
    propertyManagerCompanyId: "pm-company-1",
    status: "active",
    relationshipScope: {
      propertyScope: { mode: "selected_properties", propertyIds: ["property-a", "property-b"] },
      workspaceScopes: ["dashboard", "operations"],
    },
    createdByLandlordOwnerUserId: "landlord-owner-1",
    acceptedByCompanyAdminUserId: "company-admin-1",
    createdAt: "2026-06-24T01:00:00.000Z",
    updatedAt: "2026-06-24T02:00:00.000Z",
    startedAt: "2026-06-24T02:00:00.000Z",
    suspendedAt: null,
    suspendedByUserId: null,
    reactivatedAt: null,
    terminatedAt: null,
    terminatedByUserId: null,
    terminationReason: null,
    auditEventIds: [],
    ...overrides,
  };
  writeCollectionDoc("landlordCompanyRelationships", relationship.relationshipId, relationship);
  return relationship;
}

function seedAssignment(overrides: Partial<StoredDoc> = {}) {
  const assignment = {
    assignmentId: overrides.assignmentId || `pm-staff-assignment-${readCollection("propertyManagerCompanyStaffAssignments").length + 1}`,
    propertyManagerCompanyId: "pm-company-1",
    relationshipId: "relationship-active",
    staffUserId: "company-staff-1",
    assignedByUserId: "company-admin-1",
    staffRole: "property_manager",
    status: "active",
    propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
    workspaceScopes: ["dashboard"],
    createdAt: "2026-06-24T03:00:00.000Z",
    updatedAt: "2026-06-24T03:00:00.000Z",
    suspendedAt: null,
    suspendedByUserId: null,
    suspendedReason: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    removedAt: null,
    removedByUserId: null,
    removedReason: null,
    auditEventIds: [],
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanyStaffAssignments", assignment.assignmentId, assignment);
  return assignment;
}

function seedActiveCompanyAccess() {
  seedMembership({ membershipId: "membership-admin", userId: "company-admin-1", role: "company_admin" });
  seedMembership({ membershipId: "membership-owner", userId: "company-owner-1", role: "company_owner" });
  seedMembership({ membershipId: "membership-staff", userId: "company-staff-1", role: "property_manager" });
  seedRelationship();
}

describe("property manager company staff assignment routes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates active staff assignments with owner/admin authority and metadata-only audit", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();

    const response = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
      body: {
        ...validAssignmentBody,
        relationshipId: "relationship-active",
        propertyManagerCompanyId: "pm-company-2",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.assignment).toEqual(
      expect.objectContaining({
        propertyManagerCompanyId: "pm-company-1",
        relationshipId: "relationship-active",
        staffUserId: "company-staff-1",
        staffRole: "property_manager",
        status: "active",
        propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
        workspaceScopes: ["dashboard"],
        staffDisplayLabel: "Company staff",
      })
    );
    expect(response.body.assignment).not.toHaveProperty("auditEventIds");

    const assignments = readCollection("propertyManagerCompanyStaffAssignments");
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toEqual(expect.objectContaining({ status: "active", assignedByUserId: "company-admin-1" }));

    const auditEvents = readCollection("propertyManagerCompanyAuditEvents");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        eventType: "staff_assignment_created",
        actorUserId: "company-admin-1",
        actorCompanyId: "pm-company-1",
        propertyManagerCompanyId: "pm-company-1",
        actingForLandlordId: "landlord-1",
        relationshipId: "relationship-active",
        assignmentId: assignments[0].assignmentId,
        staffUserId: "company-staff-1",
        role: "property_manager",
        outcome: "created",
        statusTransition: { from: null, to: "active" },
        metadataOnly: true,
      })
    );

    const ownerCreated = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyOwnerUser,
      body: { ...validAssignmentBody, staffRole: "leasing_agent", workspaceScopes: ["operations"] },
    });
    expect(ownerCreated.status).toBe(201);
  });

  it("lists company-scoped and relationship-scoped assignments with safe projections only", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();
    seedAssignment({ assignmentId: "assignment-active", relationshipId: "relationship-active", updatedAt: "2026-06-24T03:00:00.000Z" });
    seedRelationship({ relationshipId: "relationship-second" });
    seedAssignment({ assignmentId: "assignment-second", relationshipId: "relationship-second", updatedAt: "2026-06-24T04:00:00.000Z" });
    seedAssignment({ assignmentId: "assignment-other-company", propertyManagerCompanyId: "pm-company-2", relationshipId: "relationship-other" });

    const all = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
    });
    expect(all.status).toBe(200);
    expect(all.body.assignments.map((assignment: any) => assignment.assignmentId)).toEqual(["assignment-second", "assignment-active"]);
    expect(JSON.stringify(all.body.assignments)).not.toContain("auditEventIds");

    const relationshipScoped = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/staff-assignments?relationshipId=relationship-active",
      user: companyAdminUser,
    });
    expect(relationshipScoped.status).toBe(200);
    expect(relationshipScoped.body.assignments).toHaveLength(1);
    expect(relationshipScoped.body.assignments[0]).toEqual(expect.objectContaining({ assignmentId: "assignment-active" }));
  });

  it("denies non-admin, unknown role, and inactive actor memberships", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();

    const deniedRoles = [
      "regional_manager",
      "property_manager",
      "leasing_agent",
      "office_administrator",
      "maintenance_coordinator",
      "read_only_staff",
      "unknown",
    ];
    for (const role of deniedRoles) {
      collections.get("propertyManagerCompanyMemberships")?.delete("membership-admin");
      seedMembership({ membershipId: "membership-admin", userId: "company-admin-1", role });
      const response = await invokeRouter(propertyManagerCompanyRoutes, {
        method: "POST",
        url: "/pm-company-1/staff-assignments",
        user: companyAdminUser,
        body: validAssignmentBody,
      });
      expect(response.status).toBe(403);
      expect(response.body.error).toBe(role === "unknown" ? "INVALID_COMPANY_ROLE" : "COMPANY_ASSIGNMENT_MANAGER_REQUIRED");
    }

    collections.get("propertyManagerCompanyMemberships")?.delete("membership-admin");
    seedMembership({ membershipId: "membership-admin", userId: "company-admin-1", role: "company_admin", status: "suspended" });
    const inactive = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
    });
    expect(inactive.status).toBe(403);
    expect(inactive.body.error).toBe("PROPERTY_MANAGER_COMPANY_MEMBERSHIP_NOT_ACTIVE");
  });

  it("requires active target staff membership and active landlord-company relationship", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();

    collections.get("propertyManagerCompanyMemberships")?.delete("membership-staff");
    seedMembership({ membershipId: "membership-staff", userId: "company-staff-1", role: "property_manager", status: "suspended" });
    const inactiveStaff = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
      body: validAssignmentBody,
    });
    expect(inactiveStaff.status).toBe(403);
    expect(inactiveStaff.body.error).toBe("MEMBERSHIP_NOT_ACTIVE");

    for (const status of ["pending", "suspended", "terminated"]) {
      collections.get("landlordCompanyRelationships")?.clear();
      seedRelationship({ relationshipId: `relationship-${status}`, status });
      collections.get("propertyManagerCompanyMemberships")?.delete("membership-staff");
      seedMembership({ membershipId: "membership-staff", userId: "company-staff-1", role: "property_manager", status: "active" });
      const response = await invokeRouter(propertyManagerCompanyRoutes, {
        method: "POST",
        url: "/pm-company-1/staff-assignments",
        user: companyAdminUser,
        body: { ...validAssignmentBody, relationshipId: `relationship-${status}` },
      });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("RELATIONSHIP_NOT_ACTIVE");
    }
  });

  it("enforces property and workspace scope ceilings, including billing/settings denial", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();

    const propertyOutsideRelationship = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
      body: { ...validAssignmentBody, propertyScope: { mode: "selected_properties", propertyIds: ["property-c"] } },
    });
    expect(propertyOutsideRelationship.status).toBe(400);
    expect(propertyOutsideRelationship.body.error).toBe("ASSIGNMENT_SCOPE_EXCEEDS_RELATIONSHIP_SCOPE");

    const workspaceOutsideRelationship = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
      body: { ...validAssignmentBody, workspaceScopes: ["leases"] },
    });
    expect(workspaceOutsideRelationship.status).toBe(400);
    expect(workspaceOutsideRelationship.body.error).toBe("ASSIGNMENT_SCOPE_EXCEEDS_RELATIONSHIP_SCOPE");

    const billingScope = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: companyAdminUser,
      body: { ...validAssignmentBody, workspaceScopes: ["settings_billing"] },
    });
    expect(billingScope.status).toBe(400);
    expect(billingScope.body.error).toBe("COMPANY_BILLING_SCOPE_NOT_ALLOWED");
  });

  it("supports suspend, reactivate, and remove lifecycle with audit events", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();
    seedAssignment({ assignmentId: "assignment-lifecycle" });

    const suspended = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-lifecycle/suspend",
      user: companyAdminUser,
      body: { reason: "coverage change" },
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.assignment).toEqual(
      expect.objectContaining({
        assignmentId: "assignment-lifecycle",
        status: "suspended",
        suspendedByUserId: "company-admin-1",
        suspendedReason: "coverage change",
      })
    );

    const reactivated = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-lifecycle/reactivate",
      user: companyAdminUser,
    });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.assignment.status).toBe("active");

    const removed = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-lifecycle/remove",
      user: companyAdminUser,
      body: { reason: "handover complete" },
    });
    expect(removed.status).toBe(200);
    expect(removed.body.assignment).toEqual(
      expect.objectContaining({
        status: "removed",
        removedByUserId: "company-admin-1",
        removedReason: "handover complete",
      })
    );

    const auditEvents = readCollection("propertyManagerCompanyAuditEvents");
    expect(auditEvents.map((event) => event.eventType)).toEqual([
      "staff_assignment_suspended",
      "staff_assignment_reactivated",
      "staff_assignment_removed",
    ]);
    expect(auditEvents.map((event) => event.statusTransition)).toEqual([
      { from: "active", to: "suspended" },
      { from: "suspended", to: "active" },
      { from: "active", to: "removed" },
    ]);
  });

  it("fails closed on invalid lifecycle transitions", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();
    seedAssignment({ assignmentId: "assignment-active", status: "active" });
    seedAssignment({ assignmentId: "assignment-suspended", status: "suspended" });
    seedAssignment({ assignmentId: "assignment-removed", status: "removed" });

    const activeToActive = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-active/reactivate",
      user: companyAdminUser,
    });
    expect(activeToActive.status).toBe(409);
    expect(activeToActive.body.error).toBe("STAFF_ASSIGNMENT_NOT_SUSPENDED");

    const suspendedToSuspended = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-suspended/suspend",
      user: companyAdminUser,
    });
    expect(suspendedToSuspended.status).toBe(409);
    expect(suspendedToSuspended.body.error).toBe("STAFF_ASSIGNMENT_NOT_ACTIVE");

    const removedToActive = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-removed/reactivate",
      user: companyAdminUser,
    });
    expect(removedToActive.status).toBe(409);
    expect(removedToActive.body.error).toBe("STAFF_ASSIGNMENT_NOT_SUSPENDED");

    const removedToRemoved = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-removed/remove",
      user: companyAdminUser,
    });
    expect(removedToRemoved.status).toBe(409);
    expect(removedToRemoved.body.error).toBe("STAFF_ASSIGNMENT_ALREADY_REMOVED");
  });

  it("denies cross-company assignment access", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedActiveCompanyAccess();
    seedMembership({
      membershipId: "other-company-admin",
      companyId: "pm-company-2",
      userId: "company-admin-2",
      role: "company_admin",
    });
    seedRelationship({
      relationshipId: "relationship-company-2",
      propertyManagerCompanyId: "pm-company-2",
    });
    seedAssignment({
      assignmentId: "assignment-company-2",
      propertyManagerCompanyId: "pm-company-2",
      relationshipId: "relationship-company-2",
    });

    const crossCompanyCreate = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments",
      user: otherCompanyAdminUser,
      body: validAssignmentBody,
    });
    expect(crossCompanyCreate.status).toBe(403);
    expect(crossCompanyCreate.body.error).toBe("PROPERTY_MANAGER_COMPANY_MEMBERSHIP_NOT_FOUND");

    const crossCompanyLifecycle = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "POST",
      url: "/pm-company-1/staff-assignments/assignment-company-2/suspend",
      user: companyAdminUser,
    });
    expect(crossCompanyLifecycle.status).toBe(404);
    expect(crossCompanyLifecycle.body.error).toBe("PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_NOT_FOUND");
  });
});
