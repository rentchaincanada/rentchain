import { describe, expect, it } from "vitest";

import {
  appendAuditEvent,
  appendAuditEventSafely,
  createExportAuditEventPayload,
  generateExportAuditEventId,
  generateExportAuditSafeReference,
  getAuditTrailForPackage,
  getExportAuditTrail,
  projectExportAuditEvent,
  type ExportAuditTrailFirestoreLike,
} from "../export-audit-trail-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:ffffffffffffffffffff";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const packageRef = "exp_pkg_v1_cccccccccccccccccccc_dddddddddddddddddddd";
const timestamp = "2026-06-04T16:00:00.000Z";

type Filter = { field: string; op: string; value: unknown };

function createAuditStore() {
  const collections = new Map<string, Map<string, ExportAuditEventPayload>>();

  function ensure(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  class Query {
    constructor(private readonly name: string, private readonly filters: Filter[] = [], private readonly max: number | null = null) {}

    where(field: string, op: string, value: unknown) {
      return new Query(this.name, [...this.filters, { field, op, value }], this.max);
    }

    orderBy() {
      return this;
    }

    limit(limit: number) {
      return new Query(this.name, this.filters, limit);
    }

    async get() {
      const docs = Array.from(ensure(this.name).values())
        .filter((event) =>
          this.filters.every((filter) => {
            const value = event[filter.field as keyof ExportAuditEventPayload];
            return filter.op === "==" ? value === filter.value : true;
          })
        )
        .slice(0, this.max || undefined)
        .map((event) => ({ data: () => event }));
      return { docs };
    }
  }

  const firestore: ExportAuditTrailFirestoreLike = {
    collection(name: string) {
      const query = new Query(name);
      return {
        doc(id: string) {
          return {
            async get() {
              const event = ensure(name).get(id);
              return { exists: Boolean(event), data: () => event };
            },
            async create(data: ExportAuditEventPayload) {
              if (ensure(name).has(id)) throw new Error("already_exists");
              ensure(name).set(id, data);
            },
            async set(data: ExportAuditEventPayload) {
              ensure(name).set(id, data);
            },
          };
        },
        where: query.where.bind(query),
        orderBy: query.orderBy.bind(query),
        limit: query.limit.bind(query),
        get: query.get.bind(query),
      };
    },
  };

  return {
    firestore,
    list: (collection = "canonicalEvents") => Array.from(ensure(collection).values()),
  };
}

function context(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    eventType: "ExportPackageAssembled" as const,
    targetType: "ExportPackage" as const,
    targetId: packageRef,
    landlordId: landlordRef,
    context: context(),
    eventSummary: "Export package assembled.",
    statusSummary: "assembled",
    reason: "InsuranceClaim",
    details: {
      evidenceCount: 2,
      checksumReference: "checksum:aaaaaaaaaaaaaaaaaaaa",
      metadataOnly: true,
    },
    timestamp,
    ...overrides,
  };
}

describe("export audit trail service", () => {
  it("generates deterministic safe references and event identifiers", () => {
    const ref = generateExportAuditSafeReference("ExportPackage", packageRef);
    const repeated = generateExportAuditSafeReference("ExportPackage", packageRef);
    const eventId = generateExportAuditEventId({
      eventType: "ExportPackageAssembled",
      timestamp,
      landlordId: landlordRef,
      targetType: "ExportPackage",
      targetId: packageRef,
      actorId: actorRef,
    });

    expect(ref).toBe(repeated);
    expect(ref).toMatch(/^exportpackage:[a-f0-9]{20}$/);
    expect(eventId).toMatch(/^export_audit:[a-f0-9]{32}$/);
    expect(`${ref} ${eventId}`).not.toContain(packageRef);
    expect(`${ref} ${eventId}`).not.toContain(landlordRef);
  });

  it("creates immutable metadata-only canonical event payloads", () => {
    const event = createExportAuditEventPayload(input());
    const projected = projectExportAuditEvent(event);

    expect(event).toMatchObject({
      eventType: "ExportPackageAssembled",
      sourceCollection: "canonicalEvents",
      metadataOnly: true,
      appendOnly: true,
      immutable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(projected.rawIdsIncluded).toBe(false);
    expect(projected.payloadIncluded).toBe(false);
    expect(JSON.stringify(event)).not.toContain(packageRef);
    expect(JSON.stringify(event)).not.toMatch(/token|secret|credential|gs:\/\/|storage\.googleapis\.com/i);
  });

  it("writes with append-only create semantics and rejects duplicates", async () => {
    const store = createAuditStore();
    const event = await appendAuditEvent(input(), { firestore: store.firestore });

    expect(store.list()).toEqual([event]);
    await expect(appendAuditEvent(input(), { firestore: store.firestore })).rejects.toThrow("already_exists");
  });

  it("keeps append failures non-blocking through the safe helper", async () => {
    const failingStore: ExportAuditTrailFirestoreLike = {
      collection() {
        return {
          doc() {
            return {
              async create() {
                throw new Error("write_failed");
              },
            };
          },
        };
      },
    };

    await expect(appendAuditEventSafely(input(), { firestore: failingStore })).resolves.toBeNull();
  });

  it("rejects unsafe details before writing", async () => {
    const store = createAuditStore();

    await expect(
      appendAuditEvent(
        input({
          details: {
            note: "contains secret token",
          },
        }),
        { firestore: store.firestore }
      )
    ).rejects.toThrow("export_audit_details_unsafe");
  });

  it("queries package audit trails with landlord scope enforced", async () => {
    const store = createAuditStore();
    await appendAuditEvent(input(), { firestore: store.firestore });
    await appendAuditEvent(
      input({
        landlordId: otherLandlordRef,
        context: context({ requestingActorScope: otherLandlordRef }),
        targetId: "exp_pkg_v1_other_safe_ref",
      }),
      { firestore: store.firestore }
    );

    const scoped = await getAuditTrailForPackage(landlordRef, packageRef, { firestore: store.firestore });
    const generic = await getExportAuditTrail({ landlordId: otherLandlordRef }, { firestore: store.firestore });

    expect(scoped).toHaveLength(1);
    expect(scoped[0]).toMatchObject({
      eventType: "ExportPackageAssembled",
      targetType: "ExportPackage",
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(JSON.stringify(scoped)).not.toContain(otherLandlordRef);
    expect(generic).toHaveLength(1);
  });
});
