import { beforeEach, describe, expect, it } from "vitest";
import { buildTrustComplianceSummary } from "../trustComplianceSummaryService";

const { fakeDb, resetFakeDb, seedDoc } = (() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  const clone = (value: any) => JSON.parse(JSON.stringify(value));
  const getPath = (value: any, path: string) =>
    path.split(".").reduce((current, key) => (current == null ? undefined : current[key]), value);
  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = getPath(doc?.data, field);
      if (op === "==") return actual === value;
      return false;
    });
  }
  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = [], cap = Infinity): any {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }], cap),
      limit: (limit: number) => makeQuery(name, filters, limit),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .slice(0, cap)
          .map((doc) => ({ id: doc.id, exists: true, data: () => clone(doc.data) }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
    };
  }
  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data: clone(data) }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        limit: (limit: number) => makeQuery(name, [], limit),
        get: async () => makeQuery(name).get(),
      }),
    },
  };
})();

function section(summary: any, key: string) {
  return summary.sections.find((item: any) => item.key === key);
}

describe("trustComplianceSummaryService", () => {
  beforeEach(() => {
    resetFakeDb();
  });

  it("aggregates landlord-scoped evidence and export events with safe manifest metadata", async () => {
    seedDoc("canonicalEvents", "event-own-evidence", {
      type: "lease.evidence_package_generated",
      action: "evidence_package_generated",
      status: "generated",
      actor: { id: "landlord-1", role: "landlord" },
      occurredAt: "2026-06-14T10:00:00.000Z",
      summary: "Lease evidence package PDF generated",
      metadata: {
        landlordId: "landlord-1",
        evidencePackageId: "lep_safe123",
        manifestHash: "a".repeat(64),
        manifestVersion: "lease_evidence_manifest_v1",
        packageVersion: "lease-evidence-package-pdf-v1",
        storagePath: "gs://private/raw.pdf",
        providerRequestId: "provider-secret",
      },
    });
    seedDoc("canonicalEvents", "event-own-export", {
      type: "lease.institutional_export_generated",
      action: "institutional_export_generated",
      status: "generated",
      actor: { id: "landlord-1", role: "landlord" },
      occurredAt: "2026-06-14T11:00:00.000Z",
      summary: "Lease institutional evidence export generated",
      metadata: {
        exportReason: "tribunal",
        exportScope: "lease_evidence_package",
        exportFormat: "pdf",
        retentionCategory: "export_metadata",
        sensitivity: "confidential",
        manifestHash: "b".repeat(64),
        paymentProcessorId: "pi_secret_123",
      },
    });
    seedDoc("canonicalEvents", "event-other", {
      type: "lease.institutional_export_generated",
      action: "institutional_export_generated",
      actor: { id: "landlord-2", role: "landlord" },
      occurredAt: "2026-06-14T12:00:00.000Z",
      summary: "Other landlord export",
      metadata: { landlordId: "landlord-2", manifestHash: "c".repeat(64) },
    });

    const summary = await buildTrustComplianceSummary({
      landlordId: "landlord-1",
      firestore: fakeDb,
      generatedAt: "2026-06-15T00:00:00.000Z",
    });

    expect(summary.version).toBe("trust_compliance_center_v1");
    expect(summary.landlordId).toBe("landlord-1");
    expect(section(summary, "evidence_exports")).toEqual(
      expect.objectContaining({
        count: 2,
        sourceAvailability: "available",
        lastActivityAt: "2026-06-14T11:00:00.000Z",
      })
    );
    expect(section(summary, "evidence_exports").items[0].safeMetadata).toEqual(
      expect.objectContaining({
        exportReason: "tribunal",
        exportScope: "lease_evidence_package",
        exportFormat: "pdf",
        retentionCategory: "export_metadata",
        sensitivity: "confidential",
        manifestHash: "b".repeat(64),
      })
    );
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("event-own-evidence");
    expect(serialized).not.toContain("event-other");
    expect(serialized).not.toContain("landlord-2");
    expect(serialized).not.toContain("gs://private/raw.pdf");
    expect(serialized).not.toContain("provider-secret");
    expect(serialized).not.toContain("pi_secret_123");
    expect(serialized).not.toContain("storagePath");
    expect(serialized).not.toContain("providerRequestId");
  });

  it("renders empty consent and screening sections safely when sources have no records", async () => {
    const summary = await buildTrustComplianceSummary({ landlordId: "landlord-1", firestore: fakeDb });

    expect(section(summary, "consent")).toEqual(
      expect.objectContaining({
        count: 0,
        sourceAvailability: "empty",
        emptyState: "No landlord-scoped consent records are available yet.",
      })
    );
    expect(section(summary, "screening")).toEqual(
      expect.objectContaining({
        count: 0,
        sourceAvailability: "empty",
        emptyState: "No landlord-scoped screening status records are available yet.",
      })
    );
  });

  it("bounds the recent audit trail and sorts newest first", async () => {
    for (let i = 0; i < 20; i += 1) {
      seedDoc("canonicalEvents", `event-${i}`, {
        type: "lease.updated",
        action: "updated",
        actor: { id: "landlord-1", role: "landlord" },
        occurredAt: `2026-06-14T${String(i).padStart(2, "0")}:00:00.000Z`,
        summary: `Governance event ${i}`,
        metadata: { landlordId: "landlord-1" },
      });
    }

    const summary = await buildTrustComplianceSummary({ landlordId: "landlord-1", firestore: fakeDb });

    expect(summary.recentAuditTrail).toHaveLength(12);
    expect(summary.recentAuditTrail[0].occurredAt).toBe("2026-06-14T19:00:00.000Z");
    expect(summary.recentAuditTrail[11].occurredAt).toBe("2026-06-14T08:00:00.000Z");
  });
});
