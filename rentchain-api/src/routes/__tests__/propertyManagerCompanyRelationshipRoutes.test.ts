import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, any>;

const collections = vi.hoisted(() => new Map<string, Map<string, StoredDoc>>());
const generatedIds = vi.hoisted(() => ({ value: 0 }));
const fakeDb = vi.hoisted(() => ({
  collection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    const collection = collections.get(name)!;
    return {
      doc(id?: string) {
        const docId = id || `test_doc_${++generatedIds.value}`;
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
const delegateUser = { id: "delegate-user-1", role: "delegate", landlordId: null, email: "delegate@example.com" };

const validRelationshipBody = {
  propertyManagerCompanyId: "pm-company-1",
  propertyScope: { mode: "all_current_properties", propertyIds: [] },
  workspaceScopes: ["dashboard", "operations", "properties"],
};

function seedCompany(overrides: Partial<StoredDoc> = {}) {
  const company = {
    companyId: overrides.companyId || "pm-company-1",
    companyName: "Elite Property Management",
    safeDisplayLabel: "Elite Property Management",
    status: "active",
    createdByUserId: "company-owner-1",
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    ...overrides,
  };
  writeCollectionDoc("propertyManagerCompanies", company.companyId, company);
  return company;
}

function seedRelationship(overrides: Partial<StoredDoc> = {}) {
  const relationship = {
    relationshipId: overrides.relationshipId || `landlord_pm_relationship_${readCollection("landlordCompanyRelationships").length + 1}`,
    landlordId: "landlord-1",
    propertyManagerCompanyId: "pm-company-1",
    status: "active",
    relationshipScope: {
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard", "operations", "properties"],
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
    auditEventIds: [],
    ...overrides,
  };
  writeCollectionDoc("landlordCompanyRelationships", relationship.relationshipId, relationship);
  return relationship;
}

describe("property manager company relationship routes", () => {
  beforeEach(() => {
    collections.clear();
    generatedIds.value = 0;
    seedCompany();
  });

  it("creates pending landlord-company relationships from landlord owner scope only", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");

    const response = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: {
        ...validRelationshipBody,
        landlordId: "landlord-2",
        status: "pending",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.relationship).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyManagerCompanyLabel: "Elite Property Management",
        status: "pending",
        createdByLandlordOwnerUserId: "owner-user-1",
        acceptedByCompanyAdminUserId: null,
        startedAt: null,
      })
    );
    expect(response.body.relationship).not.toHaveProperty("auditEventIds");

    const relationships = readCollection("landlordCompanyRelationships");
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual(expect.objectContaining({ landlordId: "landlord-1", status: "pending" }));

    const auditEvents = readCollection("propertyManagerCompanyAuditEvents");
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        eventType: "landlord_company_relationship_created",
        actorUserId: "owner-user-1",
        propertyManagerCompanyId: "pm-company-1",
        actingForLandlordId: "landlord-1",
        relationshipId: relationships[0].relationshipId,
        outcome: "created",
        statusTransition: { from: null, to: "pending" },
        metadataOnly: true,
      })
    );
  });

  it("rejects landlord-only active creation and inactive PM companies", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");

    const activeAttempt = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: { ...validRelationshipBody, status: "active" },
    });
    expect(activeAttempt.status).toBe(409);
    expect(activeAttempt.body.error).toBe("RELATIONSHIP_ACTIVATION_REQUIRES_COMPANY_ACCEPTANCE");

    seedCompany({ companyId: "pm-company-suspended", status: "suspended" });
    const inactiveCompany = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: { ...validRelationshipBody, propertyManagerCompanyId: "pm-company-suspended" },
    });
    expect(inactiveCompany.status).toBe(409);
    expect(inactiveCompany.body.error).toBe("PROPERTY_MANAGER_COMPANY_NOT_ACTIVE");

    const missingCompany = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: { ...validRelationshipBody, propertyManagerCompanyId: "missing-company" },
    });
    expect(missingCompany.status).toBe(404);
    expect(missingCompany.body.error).toBe("PROPERTY_MANAGER_COMPANY_NOT_FOUND");
  });

  it("lists only the authenticated landlord owner relationships and safe labels", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedRelationship({ relationshipId: "relationship-landlord-1", landlordId: "landlord-1" });
    seedRelationship({ relationshipId: "relationship-landlord-2", landlordId: "landlord-2" });

    const response = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-company-relationships?landlordId=landlord-2",
      user: ownerUser,
    });

    expect(response.status).toBe(200);
    expect(response.body.relationships).toHaveLength(1);
    expect(response.body.relationships[0]).toEqual(
      expect.objectContaining({
        relationshipId: "relationship-landlord-1",
        landlordId: "landlord-1",
        propertyManagerCompanyLabel: "Elite Property Management",
      })
    );
    expect(JSON.stringify(response.body.relationships[0])).not.toContain("auditEventIds");
  });

  it("requires landlord owner role for landlord-side relationship management", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");

    const unauthenticated = await invokeRouter(router, {
      method: "GET",
      url: "/property-manager-company-relationships",
      user: null,
    });
    expect(unauthenticated.status).toBe(401);

    const delegate = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: delegateUser,
      body: validRelationshipBody,
    });
    expect(delegate.status).toBe(403);
    expect(delegate.body.error).toBe("FORBIDDEN");
  });

  it("supports active to suspended to active to terminated lifecycle transitions with audit", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedRelationship({ relationshipId: "relationship-active", status: "active" });

    const suspended = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-active/suspend",
      user: ownerUser,
      body: { reason: "Operational pause" },
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.relationship).toEqual(
      expect.objectContaining({
        relationshipId: "relationship-active",
        status: "suspended",
        suspendedByUserId: "owner-user-1",
      })
    );

    const reactivated = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-active/reactivate",
      user: ownerUser,
    });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.relationship.status).toBe("active");

    const terminated = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-active/terminate",
      user: ownerUser,
      body: { reason: "Contract ended" },
    });
    expect(terminated.status).toBe(200);
    expect(terminated.body.relationship).toEqual(
      expect.objectContaining({
        status: "terminated",
        terminatedByUserId: "owner-user-1",
        terminationReason: "Contract ended",
      })
    );

    const auditEvents = readCollection("propertyManagerCompanyAuditEvents");
    expect(auditEvents.map((event) => event.eventType)).toEqual([
      "landlord_company_relationship_suspended",
      "landlord_company_relationship_reactivated",
      "landlord_company_relationship_terminated",
    ]);
    expect(auditEvents.map((event) => event.statusTransition)).toEqual([
      { from: "active", to: "suspended" },
      { from: "suspended", to: "active" },
      { from: "active", to: "terminated" },
    ]);
  });

  it("allows pending termination but fails closed on invalid transitions", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedRelationship({ relationshipId: "relationship-pending", status: "pending", startedAt: null });
    seedRelationship({ relationshipId: "relationship-terminated", status: "terminated" });

    const suspendPending = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-pending/suspend",
      user: ownerUser,
    });
    expect(suspendPending.status).toBe(409);
    expect(suspendPending.body.error).toBe("RELATIONSHIP_NOT_ACTIVE");

    const terminatePending = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-pending/terminate",
      user: ownerUser,
    });
    expect(terminatePending.status).toBe(200);
    expect(terminatePending.body.relationship.status).toBe("terminated");

    const reactivateTerminated = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-terminated/reactivate",
      user: ownerUser,
    });
    expect(reactivateTerminated.status).toBe(409);
    expect(reactivateTerminated.body.error).toBe("RELATIONSHIP_NOT_SUSPENDED");

    const terminateTerminated = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-terminated/terminate",
      user: ownerUser,
    });
    expect(terminateTerminated.status).toBe(409);
    expect(terminateTerminated.body.error).toBe("INVALID_RELATIONSHIP_STATUS_TRANSITION");
  });

  it("denies cross-landlord mutations and rejects invalid scope", async () => {
    const { default: router } = await import("../propertyManagerCompanyRelationshipRoutes");
    seedRelationship({ relationshipId: "relationship-landlord-1", landlordId: "landlord-1" });

    const crossLandlord = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships/relationship-landlord-1/suspend",
      user: otherOwnerUser,
    });
    expect(crossLandlord.status).toBe(404);
    expect(crossLandlord.body.error).toBe("LANDLORD_COMPANY_RELATIONSHIP_NOT_FOUND");

    const selectedWithoutProperties = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: {
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: { mode: "selected_properties", propertyIds: [] },
        workspaceScopes: ["dashboard"],
      },
    });
    expect(selectedWithoutProperties.status).toBe(400);
    expect(selectedWithoutProperties.body.error).toBe("MISSING_SELECTED_PROPERTY_SCOPE");

    const billingScope = await invokeRouter(router, {
      method: "POST",
      url: "/property-manager-company-relationships",
      user: ownerUser,
      body: {
        ...validRelationshipBody,
        workspaceScopes: ["settings_billing"],
      },
    });
    expect(billingScope.status).toBe(400);
    expect(billingScope.body.error).toBe("COMPANY_BILLING_SCOPE_NOT_ALLOWED");
  });
});
