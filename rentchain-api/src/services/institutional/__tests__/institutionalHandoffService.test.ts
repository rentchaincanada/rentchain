import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) {
    collections.set(name, new Map<string, any>());
  }
  return collections.get(name)!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

vi.mock("../../../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        async get() {
          return {
            exists: ensureCollection(name).has(id),
            data: () => clone(ensureCollection(name).get(id)),
          };
        },
        async set(value: any) {
          ensureCollection(name).set(id, clone(value));
        },
      }),
      where: (field: string, op: string, value: any) => ({
        async get() {
          const docs = Array.from(ensureCollection(name).entries())
            .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
            .map(([id, data]) => ({
              id,
              data: () => clone(data),
            }));
          return { docs };
        },
      }),
    }),
  },
}));

describe("institutionalHandoffService", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("creates a metadata-only institutional handoff draft with sanitized displayName", async () => {
    const { createInstitutionalHandoffDraft } = await import("../institutionalHandoffService");
    const created = await createInstitutionalHandoffDraft({
      tenantId: "tenant-1",
      institutionProfile: {
        institutionType: "bank",
        displayName: "  Example   Bank   Sandbox  ",
        integrationMode: "sandbox",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "partial",
        validationStatus: "valid_with_warnings",
      },
    });

    expect(created.institutionProfile.displayName).toBe("Example Bank Sandbox");
    expect(created.exportStorage).toBe("metadata_only");
    expect(created.outboundTransfer).toBe("none");
    expect(created.handoffStatus).toBe("ready_for_manual_review");
    const payload = JSON.stringify(created);
    expect(payload).not.toContain("\"warnings\":");
    expect(payload).not.toContain("\"checks\":");
    expect(payload).not.toContain("paymentMethod");
    expect(payload).not.toContain("documentUrl");
  });

  it("marks fully ready valid drafts as ready for tenant-managed manual release", async () => {
    const { createInstitutionalHandoffDraft } = await import("../institutionalHandoffService");
    const created = await createInstitutionalHandoffDraft({
      tenantId: "tenant-1",
      institutionProfile: {
        institutionType: "lender",
        displayName: "Ready Lender Draft",
        integrationMode: "manual_export",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "ready",
        validationStatus: "valid",
      },
    });

    expect(created.exportStorage).toBe("metadata_only");
    expect(created.outboundTransfer).toBe("none");
    expect(created.handoffStatus).toBe("ready_for_tenant_managed_release");
  });

  it("lists only the tenant handoff drafts sorted by updatedAt descending and soft-voids owned drafts", async () => {
    const {
      createInstitutionalHandoffDraft,
      listInstitutionalHandoffsForTenant,
      softVoidInstitutionalHandoff,
    } = await import("../institutionalHandoffService");

    const first = await createInstitutionalHandoffDraft({
      tenantId: "tenant-1",
      institutionProfile: {
        institutionType: "internal_review",
        displayName: "",
        integrationMode: "sandbox",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "not_ready",
        validationStatus: "invalid",
      },
    });
    const second = await createInstitutionalHandoffDraft({
      tenantId: "tenant-2",
      institutionProfile: {
        institutionType: "lender",
        displayName: "Lender draft",
        integrationMode: "manual_export",
      },
      schema: {
        name: "rentchain.institutional_identity_package",
        version: "2.0",
      },
      compliance: {
        readinessStatus: "ready",
        validationStatus: "valid",
      },
    });

    const listed = await listInstitutionalHandoffsForTenant("tenant-1");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(first.id);

    const denied = await softVoidInstitutionalHandoff("tenant-1", second.id);
    expect(denied).toBeNull();

    const voided = await softVoidInstitutionalHandoff("tenant-1", first.id);
    expect(voided?.handoffStatus).toBe("voided");
  });
});
