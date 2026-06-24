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

const ownerUser = { id: "owner-user-1", role: "landlord", landlordId: "landlord-1", email: "owner@example.com" };
const otherOwnerUser = { id: "owner-user-2", role: "landlord", landlordId: "landlord-2", email: "other@example.com" };
const delegateUser = { id: "delegate-user-1", role: "delegate", email: "delegate@example.com" };
const companyAdminUser = { id: "company-admin-1", role: "property_manager_company", email: "admin@elite.example" };
const companyStaffUser = { id: "company-staff-1", role: "property_manager_company", email: "staff@elite.example" };
const otherCompanyAdminUser = { id: "company-admin-2", role: "property_manager_company", email: "admin@other.example" };

function seedCompany(overrides: Partial<StoredDoc> = {}) {
  const company = {
    companyId: overrides.companyId || "pm-company-1",
    companyName: "Elite Property Management",
    safeDisplayLabel: "Elite Property Management",
    status: "active",
    createdByUserId: "company-owner-1",
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    privateNotes: "do not expose",
    tokenSecret: "secret-token",
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanies", company.companyId, company);
  return company;
}

function seedMembership(overrides: Partial<StoredDoc> = {}) {
  const membership = {
    membershipId: overrides.membershipId || `pm-membership-${readCollection("propertyManagerCompanyMemberships").length + 1}`,
    companyId: "pm-company-1",
    userId: "company-admin-1",
    safeDisplayLabel: "Alex Admin",
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
    privateNotes: "membership private",
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanyMemberships", membership.membershipId, membership);
  return membership;
}

function seedRelationship(overrides: Partial<StoredDoc> = {}) {
  const relationship = {
    relationshipId: overrides.relationshipId || "relationship-active",
    landlordId: "landlord-1",
    landlordWorkspaceLabel: "Halifax Portfolio",
    propertyManagerCompanyId: "pm-company-1",
    status: "active",
    relationshipScope: {
      propertyScope: { mode: "selected_properties", propertyIds: ["property-a", "property-b"] },
      workspaceScopes: ["dashboard", "operations"],
    },
    createdByLandlordOwnerUserId: "owner-user-1",
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
    auditEventIds: ["audit-secret"],
    ...overrides,
  };
  writeCollectionDoc("landlordCompanyRelationships", relationship.relationshipId, relationship);
  return relationship;
}

function seedAssignment(overrides: Partial<StoredDoc> = {}) {
  const assignment = {
    assignmentId: overrides.assignmentId || `assignment-${readCollection("propertyManagerCompanyStaffAssignments").length + 1}`,
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
    auditEventIds: ["assignment-audit-secret"],
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanyStaffAssignments", assignment.assignmentId, assignment);
  return assignment;
}

function seedBaseCompanyData() {
  seedCompany();
  seedMembership({ membershipId: "admin-membership", userId: "company-admin-1", role: "company_admin", safeDisplayLabel: "Alex Admin" });
  seedMembership({ membershipId: "staff-membership", userId: "company-staff-1", role: "property_manager", safeDisplayLabel: "Pat Manager" });
  seedRelationship();
}

describe("property manager company management read routes", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("supports safe PM company discovery for landlord owners only", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedCompany();
    seedCompany({ companyId: "pm-company-2", companyName: "Harbour Managers", safeDisplayLabel: "Harbour Managers" });
    seedCompany({ companyId: "pm-company-suspended", status: "suspended", safeDisplayLabel: "Suspended Managers" });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-companies/search?q=elite",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.companies).toEqual([
      {
        propertyManagerCompanyId: "pm-company-1",
        companyLabel: "Elite Property Management",
        status: "active",
      },
    ]);
    expect(JSON.stringify(response.body.companies)).not.toContain("privateNotes");
    expect(JSON.stringify(response.body.companies)).not.toContain("secret-token");
    expect(JSON.stringify(response.body.companies)).not.toContain("companyName");

    const denied = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-companies/search",
      user: delegateUser,
    });
    expect(denied.status).toBe(403);
  });

  it("lists landlord-scoped relationships with safe company labels and staff assignment summary", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedBaseCompanyData();
    seedRelationship({ relationshipId: "relationship-other-landlord", landlordId: "landlord-2" });
    seedAssignment({ assignmentId: "assignment-active", status: "active" });
    seedAssignment({ assignmentId: "assignment-suspended", status: "suspended" });
    seedAssignment({ assignmentId: "assignment-other-landlord", relationshipId: "relationship-other-landlord" });
    seedRelationship({ relationshipId: "relationship-malformed", status: "unknown" });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-company-relationships?landlordId=landlord-2",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.relationships).toHaveLength(1);
    expect(response.body.relationships[0]).toEqual(
      expect.objectContaining({
        relationshipId: "relationship-active",
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyManagerCompanyLabel: "Elite Property Management",
        landlordWorkspaceLabel: "Halifax Portfolio",
        status: "active",
        staffAssignmentSummary: {
          total: 2,
          active: 1,
          suspended: 1,
          removed: 0,
        },
      })
    );
    const serialized = JSON.stringify(response.body.relationships);
    expect(serialized).not.toContain("auditEventIds");
    expect(serialized).not.toContain("terminationReason");
    expect(serialized).not.toContain("relationship-other-landlord");
  });

  it("allows landlord owners to view staff assigned under their relationship only", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedBaseCompanyData();
    seedAssignment();

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-company-relationships/relationship-active/staff-assignments",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.assignments).toHaveLength(1);
    expect(response.body.assignments[0]).toEqual(
      expect.objectContaining({
        assignmentId: expect.any(String),
        relationshipId: "relationship-active",
        staffUserId: "company-staff-1",
        staffLabel: "Pat Manager",
        staffRole: "property_manager",
        status: "active",
      })
    );
    expect(JSON.stringify(response.body.assignments)).not.toContain("auditEventIds");
    expect(JSON.stringify(response.body.assignments)).not.toContain("suspendedReason");

    const crossLandlord = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-company-relationships/relationship-active/staff-assignments",
      user: otherOwnerUser,
    });
    expect(crossLandlord.status).toBe(404);
    expect(crossLandlord.body.error).toBe("LANDLORD_COMPANY_RELATIONSHIP_NOT_FOUND");
  });

  it("lists actor PM company contexts only for active owner/admin memberships", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedCompany();
    seedCompany({ companyId: "pm-company-2", safeDisplayLabel: "Second Company" });
    seedCompany({ companyId: "pm-company-3", safeDisplayLabel: "Staff Company" });
    seedMembership({ membershipId: "admin-company-1", userId: "company-admin-1", companyId: "pm-company-1", role: "company_admin" });
    seedMembership({ membershipId: "admin-company-2", userId: "company-admin-1", companyId: "pm-company-2", role: "company_owner" });
    seedMembership({ membershipId: "staff-company-3", userId: "company-admin-1", companyId: "pm-company-3", role: "property_manager" });

    const response = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/my-companies",
      user: companyAdminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.companies.map((company: any) => company.companyLabel)).toEqual([
      "Elite Property Management",
      "Second Company",
    ]);
    expect(JSON.stringify(response.body.companies)).not.toContain("Staff Company");
    expect(JSON.stringify(response.body.companies)).not.toContain("membershipId");
  });

  it("lists company relationships for active Company Owner/Admin without cross-company leakage", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedBaseCompanyData();
    seedRelationship({ relationshipId: "relationship-pending", status: "pending", startedAt: null });
    seedRelationship({ relationshipId: "relationship-other-company", propertyManagerCompanyId: "pm-company-2", landlordWorkspaceLabel: "Other Portfolio" });
    seedMembership({ membershipId: "other-company-admin", companyId: "pm-company-2", userId: "company-admin-2", role: "company_admin" });

    const response = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/relationships?companyId=pm-company-2",
      user: companyAdminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.relationships.map((relationship: any) => relationship.relationshipId)).toEqual([
      "relationship-active",
      "relationship-pending",
    ]);
    expect(response.body.relationships[0]).toEqual(
      expect.objectContaining({
        landlordWorkspaceLabel: "Halifax Portfolio",
        propertyManagerCompanyLabel: "Elite Property Management",
      })
    );
    expect(JSON.stringify(response.body.relationships)).not.toContain("relationship-other-company");
    expect(JSON.stringify(response.body.relationships)).not.toContain("auditEventIds");

    const staffDenied = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/relationships",
      user: companyStaffUser,
    });
    expect(staffDenied.status).toBe(403);

    const crossCompanyDenied = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/relationships",
      user: otherCompanyAdminUser,
    });
    expect(crossCompanyDenied.status).toBe(403);
  });

  it("lists company members with safe labels and lifecycle statuses only", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedBaseCompanyData();
    seedMembership({
      membershipId: "suspended-member",
      userId: "company-suspended-1",
      safeDisplayLabel: "Sam Suspended",
      role: "leasing_agent",
      status: "suspended",
      suspendedAt: "2026-06-24T04:00:00.000Z",
    });
    seedMembership({
      membershipId: "removed-member",
      userId: "company-removed-1",
      safeDisplayLabel: "Riley Removed",
      role: "read_only_staff",
      status: "removed",
      removedAt: "2026-06-24T05:00:00.000Z",
    });

    const response = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/members",
      user: companyAdminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.members.map((member: any) => member.status).sort()).toEqual(["active", "active", "removed", "suspended"]);
    expect(response.body.members).toContainEqual(
      expect.objectContaining({ staffUserId: "company-suspended-1", staffLabel: "Sam Suspended", status: "suspended" })
    );
    const serialized = JSON.stringify(response.body.members);
    expect(serialized).not.toContain("membershipId");
    expect(serialized).not.toContain("invitedByUserId");
    expect(serialized).not.toContain("createdByUserId");
    expect(serialized).not.toContain("privateNotes");
  });

  it("lists company assignment projections by relationship with safe staff labels", async () => {
    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedBaseCompanyData();
    seedRelationship({ relationshipId: "relationship-second" });
    seedAssignment({ assignmentId: "assignment-active", relationshipId: "relationship-active" });
    seedAssignment({ assignmentId: "assignment-second", relationshipId: "relationship-second", status: "removed" });
    seedAssignment({ assignmentId: "assignment-other-company", propertyManagerCompanyId: "pm-company-2", relationshipId: "relationship-other" });

    const response = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/staff-assignments?relationshipId=relationship-active",
      user: companyAdminUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.assignments).toHaveLength(1);
    expect(response.body.assignments[0]).toEqual(
      expect.objectContaining({
        assignmentId: "assignment-active",
        staffLabel: "Pat Manager",
        staffDisplayLabel: "Pat Manager",
        staffRole: "property_manager",
        status: "active",
      })
    );
    const serialized = JSON.stringify(response.body.assignments);
    expect(serialized).not.toContain("assignment-other-company");
    expect(serialized).not.toContain("auditEventIds");
    expect(serialized).not.toContain("removedReason");
    expect(serialized).not.toContain("assignedByUserId");

    const crossRelationship = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/pm-company-1/staff-assignments?relationshipId=relationship-other",
      user: companyAdminUser,
    });
    expect(crossRelationship.status).toBe(404);
  });
});
