import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map<string, any>());
  return collections.get(name)!;
}

function clone(value: any) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

const { sendEmailMock, logAuditEventMock, createTenancyIfMissingMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(async () => undefined),
  logAuditEventMock: vi.fn(async () => undefined),
  createTenancyIfMissingMock: vi.fn(async () => undefined),
}));

const dbMock = {
  collection: (name: string) => ({
    doc: (id?: string) => {
      const docId = id || `doc_${ensureCollection(name).size + 1}`;
      return {
        id: docId,
        get: async () => ({
          id: docId,
          exists: ensureCollection(name).has(docId),
          data: () => clone(ensureCollection(name).get(docId)),
        }),
        set: async (value: any, opts?: { merge?: boolean }) => {
          const current = ensureCollection(name).get(docId) || {};
          ensureCollection(name).set(docId, opts?.merge ? { ...current, ...clone(value) } : clone(value));
        },
      };
    },
    where: (field: string, op: string, value: any) => ({
      get: async () => {
        const docs = Array.from(ensureCollection(name).entries())
          .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
          .map(([id, data]) => ({ id, exists: true, data: () => clone(data) }));
        return { docs, empty: docs.length === 0 };
      },
    }),
  }),
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

vi.mock("../propertyService", () => ({ propertyService: { getById: vi.fn(() => null) } }));
vi.mock("../screeningsService", () => ({ runScreeningWithCredits: vi.fn() }));
vi.mock("../auditEventsService", () => ({ logAuditEvent: logAuditEventMock }));
vi.mock("../emailService", () => ({ sendEmail: sendEmailMock }));
vi.mock("../../email/templates/baseEmailTemplate", () => ({
  buildEmailHtml: vi.fn(() => "<p>invite</p>"),
  buildEmailText: vi.fn(() => "invite"),
}));
vi.mock("../tenanciesService", () => ({ createTenancyIfMissing: createTenancyIfMissingMock }));
vi.mock("../tenantPortal/tenantEventLogService", () => ({
  recordTenantEvent: vi.fn(async () => ({ id: "event-1" })),
}));

describe("applicationConversionService", () => {
  beforeEach(() => {
    collections.clear();
    sendEmailMock.mockClear();
    logAuditEventMock.mockClear();
    createTenancyIfMissingMock.mockClear();
    process.env.EMAIL_FROM = "noreply@rentchain.test";
    process.env.PUBLIC_APP_URL = "https://www.rentchain.test";
  });

  it("converts rentalApplications records and creates a hashed tenant invite", async () => {
    ensureCollection("rentalApplications").set("app-1", {
      id: "app-1",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicant: {
        firstName: "Jamie",
        lastName: "Stone",
        email: "jamie@example.com",
      },
      status: "APPROVED",
    });

    const { convertApplicationToTenant } = await import("../applicationConversionService");
    const result = await convertApplicationToTenant({
      landlordId: "landlord-1",
      applicationId: "app-1",
      runScreening: false,
      actorUserId: "landlord-1",
    });

    expect(result.inviteUrl).toContain("/tenant/invite/");
    expect(result.inviteEmailed).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "jamie@example.com" }));
    const invites = Array.from(ensureCollection("tenancy_invites").values());
    expect(invites).toHaveLength(1);
    expect(invites[0]?.token_hash).toBeTruthy();
    expect(invites[0]?.token).toBeUndefined();
    expect(invites[0]?.application_id).toBe("app-1");
    expect(invites[0]?.tenant_id).toBe(result.tenantId);
    expect(ensureCollection("tenants").size).toBe(1);
    expect(ensureCollection("tenants").get(result.tenantId)).toMatchObject({
      id: result.tenantId,
      landlordId: "landlord-1",
      applicationId: "app-1",
      source: "application_conversion",
    });
    expect(ensureCollection("rentalApplications").get("app-1")?.convertedTenantId).toBe(result.tenantId);
  });

  it("does not create another tenant when conversion is repeated for the same application", async () => {
    ensureCollection("rentalApplications").set("app-repeat", {
      id: "app-repeat",
      landlordId: "landlord-1",
      propertyId: "property-1",
      unitId: "unit-1",
      applicantEmail: "repeat@example.com",
      applicantFullName: "Repeat Tenant",
      status: "APPROVED",
    });

    const { convertApplicationToTenant } = await import("../applicationConversionService");
    const first = await convertApplicationToTenant({
      landlordId: "landlord-1",
      applicationId: "app-repeat",
      runScreening: false,
      actorUserId: "landlord-1",
    });
    const second = await convertApplicationToTenant({
      landlordId: "landlord-1",
      applicationId: "app-repeat",
      runScreening: false,
      actorUserId: "landlord-1",
    });

    expect(second).toMatchObject({ tenantId: first.tenantId, alreadyConverted: true });
    expect(ensureCollection("tenants").size).toBe(1);
    expect(ensureCollection("tenancy_invites").size).toBe(1);
  });
});
