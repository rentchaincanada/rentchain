import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

type CollectionContract = {
  collection: "canonicalEvents" | "canonicalAuditEvents" | "events" | "adminAuditEvents" | "registryAuditLog";
  allowedWrites: Array<"create" | "add" | "set_merge_false" | "set_auto_id">;
  disallowedWrites: Array<"update" | "delete" | "set_merge_true">;
  compliance: "full" | "partial" | "absent";
  requiresScopedReads: boolean;
};

const repoRoot = resolve(__dirname, "../../../..");

function source(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const contracts: CollectionContract[] = [
  {
    collection: "canonicalEvents",
    allowedWrites: ["create", "set_merge_false"],
    disallowedWrites: ["update", "delete", "set_merge_true"],
    compliance: "full",
    requiresScopedReads: true,
  },
  {
    collection: "canonicalAuditEvents",
    allowedWrites: [],
    disallowedWrites: ["update", "delete", "set_merge_true"],
    compliance: "absent",
    requiresScopedReads: true,
  },
  {
    collection: "events",
    allowedWrites: ["set_auto_id", "set_merge_false", "add"],
    disallowedWrites: ["update", "delete", "set_merge_true"],
    compliance: "partial",
    requiresScopedReads: true,
  },
  {
    collection: "adminAuditEvents",
    allowedWrites: ["add"],
    disallowedWrites: ["update", "delete", "set_merge_true"],
    compliance: "partial",
    requiresScopedReads: true,
  },
  {
    collection: "registryAuditLog",
    allowedWrites: ["add", "set_auto_id"],
    disallowedWrites: ["update", "delete", "set_merge_true"],
    compliance: "partial",
    requiresScopedReads: true,
  },
];

function contractFor(collection: CollectionContract["collection"]) {
  const contract = contracts.find((item) => item.collection === collection);
  if (!contract) throw new Error(`missing_contract:${collection}`);
  return contract;
}

function containsSensitiveProjection(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  return (
    serialized.includes("bearer ") ||
    serialized.includes("password=") ||
    serialized.includes("secret=") ||
    serialized.includes("credential=")
  );
}

describe("audit immutability contract", () => {
  it("models canonical audit records as append-only, immutable, and metadata-only", () => {
    const record = {
      sourceCollection: "canonicalEvents",
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      actor: { rawIdsIncluded: false },
      authority: { rawIdsIncluded: false },
    };

    expect(record).toEqual(
      expect.objectContaining({
        metadataOnly: true,
        appendOnly: true,
        immutable: true,
        rawIdsIncluded: false,
      })
    );
    expect(record.actor.rawIdsIncluded).toBe(false);
    expect(record.authority.rawIdsIncluded).toBe(false);
  });

  it("documents every primary audit collection with scoped read requirements", () => {
    expect(contracts.map((contract) => contract.collection).sort()).toEqual([
      "adminAuditEvents",
      "canonicalAuditEvents",
      "canonicalEvents",
      "events",
      "registryAuditLog",
    ]);

    expect(contracts.every((contract) => contract.requiresScopedReads)).toBe(true);
    expect(contractFor("canonicalAuditEvents").compliance).toBe("absent");
  });

  it("treats merge-based audit writes as partial compliance only", () => {
    const events = contractFor("events");
    const canonical = contractFor("canonicalEvents");

    expect(events.disallowedWrites).toContain("set_merge_true");
    expect(events.compliance).toBe("partial");
    expect(canonical.compliance).toBe("full");
  });

  it("does not include sensitive material in the contract model", () => {
    expect(containsSensitiveProjection(contracts)).toBe(false);
  });
});

describe("audit immutability source checks", () => {
  it("keeps appendCanonicalAuditEvent protected by create or existence precheck plus merge false", () => {
    const body = source("rentchain-api/src/lib/canonicalAudit/appendCanonicalAuditEvent.ts");

    expect(body).toContain("ref.create");
    expect(body).toContain("existing?.exists");
    expect(body).toContain("merge: false");
    expect(body).toContain("appendOnly: true");
    expect(body).toContain("immutable: true");
    expect(body).toContain("metadataOnly: true");
    expect(body).toContain("rawIdsIncluded: false");
  });

  it("documents writeCanonicalEvent as merge false without the canonical precheck", () => {
    const body = source("rentchain-api/src/lib/events/buildEvent.ts");

    expect(body).toContain("set(event, { merge: false })");
    expect(body).not.toContain("canonical_event_already_exists");
  });

  it("keeps admin audit reads gated by authentication and system admin permission", () => {
    const body = source("rentchain-api/src/routes/adminAuditRoutes.ts");

    expect(body).toContain("requireAuth");
    expect(body).toContain('requirePermission("system.admin")');
    expect(body).toContain('router.get("/audit"');
  });

  it("records general audit event route guard limitations as a design risk", () => {
    const body = source("rentchain-api/src/routes/auditEventsRoutes.ts");
    const mountedAfterAuthDecode = source("rentchain-api/src/app.build.ts");

    expect(body).toContain('router.get("/events/recent"');
    expect(body).toContain('router.get("/tenants/:tenantId/events"');
    expect(body).toContain('router.get("/properties/:propertyId/events"');
    expect(body).not.toContain("requirePermission(");
    expect(mountedAfterAuthDecode).toContain("app.use(authenticateJwt)");
    expect(mountedAfterAuthDecode).toContain('app.use("/api/events"');
  });

  it("captures the current merge-based event dispatcher risk", () => {
    const body = source("rentchain-api/src/events/eventDispatcher.ts");

    expect(body).toContain('collection("events").doc(docId).set(event');
    expect(body).toContain("merge: true");
  });

  it("keeps registry and admin audit writers append-like through add or new document refs", () => {
    const admin = source("rentchain-api/src/services/admin/adminAuditEvents.ts");
    const registry = source("rentchain-api/src/services/registry/registryAuditService.ts");
    const registryImport = source("rentchain-api/src/services/registry/registryImportService.ts");

    expect(admin).toContain('collection("adminAuditEvents")');
    expect(admin).toContain(".add({");
    expect(registry).toContain('collection("registryAuditLog")');
    expect(registry).toContain(".add({");
    expect(registryImport).toContain('batch.set(db.collection("registryAuditLog").doc(), auditDoc)');
  });
});
