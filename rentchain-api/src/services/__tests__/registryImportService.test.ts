import { beforeEach, describe, expect, it, vi } from "vitest";

type DocData = Record<string, any>;

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, DocData>>(),
  idCounter: 0,
}));

function resetDb() {
  state.collections = new Map();
  state.idCounter = 0;
}

function ensureCollection(name: string) {
  if (!state.collections.has(name)) state.collections.set(name, new Map());
  return state.collections.get(name)!;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function mergeDoc(target: DocData | undefined, source: DocData, merge = false) {
  if (!merge || !target) return clone(source);
  return { ...clone(target), ...clone(source) };
}

function buildQuery(
  collectionName: string,
  filters: Array<{ field: string; op?: string; value: any }> = [],
  orderByFields: Array<{ field: string; dir: "asc" | "desc" }> = [],
  limitCount?: number,
  cursorValues?: any[]
) {
  return {
    where(field: string, op: string, value: any) {
      return buildQuery(collectionName, [...filters, { field, op, value }], orderByFields, limitCount, cursorValues);
    },
    orderBy(field: string, dir: "asc" | "desc" = "asc") {
      return buildQuery(collectionName, filters, [...orderByFields, { field, dir }], limitCount, cursorValues);
    },
    limit(count: number) {
      return buildQuery(collectionName, filters, orderByFields, count, cursorValues);
    },
    startAfter(...values: any[]) {
      return buildQuery(collectionName, filters, orderByFields, limitCount, values);
    },
    async get() {
      const collection = ensureCollection(collectionName);
      let docs = Array.from(collection.entries()).map(([id, data]) => ({
        id,
        exists: true,
        data: () => clone(data),
      }));
      docs = docs.filter((doc) =>
        filters.every((filter) => {
          const current = doc.data()?.[filter.field];
          if (filter.op === "array-contains") return Array.isArray(current) && current.includes(filter.value);
          return String(current ?? "") === String(filter.value ?? "");
        })
      );
      if (orderByFields.length) {
        docs.sort((a, b) => {
          for (const rule of orderByFields) {
            const av = rule.field === "__name__" ? a.id : a.data()?.[rule.field];
            const bv = rule.field === "__name__" ? b.id : b.data()?.[rule.field];
            const result = String(av ?? "").localeCompare(String(bv ?? ""));
            if (result !== 0) return rule.dir === "desc" ? -result : result;
          }
          return 0;
        });
      }
      if (cursorValues?.length && orderByFields.length) {
        docs = docs.filter((doc) => {
          for (let index = 0; index < orderByFields.length; index += 1) {
            const rule = orderByFields[index];
            const current = rule.field === "__name__" ? doc.id : doc.data()?.[rule.field];
            const cursor = cursorValues[index];
            const compare = String(current ?? "").localeCompare(String(cursor ?? ""));
            if (compare === 0) continue;
            return rule.dir === "desc" ? compare < 0 : compare > 0;
          }
          return false;
        });
      }
      if (typeof limitCount === "number") docs = docs.slice(0, limitCount);
      return { docs, empty: docs.length === 0 };
    },
  };
}

const dbMock = {
  collection(name: string) {
    const collection = ensureCollection(name);
    return {
      doc(id?: string) {
        const docId = id || `doc_${++state.idCounter}`;
        return {
          id: docId,
          async get() {
            const data = collection.get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => (data ? clone(data) : undefined),
            };
          },
          async set(data: DocData, options?: { merge?: boolean }) {
            const current = collection.get(docId);
            collection.set(docId, mergeDoc(current, data, options?.merge));
          },
        };
      },
      async add(data: DocData) {
        const docId = `doc_${++state.idCounter}`;
        collection.set(docId, clone(data));
        return { id: docId };
      },
      where(field: string, _op: string, value: any) {
        return buildQuery(name, [{ field, value }]);
      },
      orderBy(field: string, dir: "asc" | "desc" = "asc") {
        return buildQuery(name, [], field, dir);
      },
      async get() {
        return buildQuery(name).get();
      },
    };
  },
};

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../imports/firestoreBatch", () => ({
  commitInBatches: async (ops: Array<(batch: { set: (ref: any, data: any, options?: any) => void }) => void>) => {
    for (const op of ops) {
      op({
        set(ref: any, data: any, options?: any) {
          return ref.set(data, options);
        },
      });
    }
  },
}));

vi.mock("../firestorePropertiesService", () => ({
  getPropertyById: vi.fn(async () => null),
}));

describe("registryImportService", () => {
  beforeEach(() => {
    resetDb();
    vi.resetModules();
  });

  it("returns a stable empty list for imports when no records exist", async () => {
    const { listRegistryImports } = await import("../registry/registryImportService");
    await expect(listRegistryImports("halifax_r400")).resolves.toEqual([]);
  });

  it("rejects malformed property ids and missing property ids cleanly", async () => {
    const { applyRegistryMatchOverride } = await import("../registry/registryImportService");

    ensureCollection("registryRecordsNormalized").set("record-1", {
      id: "record-1",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-1",
      registrationNumber: "REG-1",
      registrationStatusNormalized: "registered",
      addressRaw: "123 Example St",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    await expect(
      applyRegistryMatchOverride({
        normalizedRecordId: "record-1",
        action: "attach",
        propertyId: "!!!",
        reason: "manual review",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "invalid_property_id", statusCode: 400 });

    await expect(
      applyRegistryMatchOverride({
        normalizedRecordId: "record-1",
        action: "attach",
        propertyId: "prop_missing_123",
        reason: "manual review",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "property_not_found", statusCode: 404 });
  });

  it("attaches, ignores, and later re-attaches a registry record while refreshing property projections", async () => {
    const { applyRegistryMatchOverride, getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-old", {
      id: "prop-old",
      landlordId: "landlord-1",
      name: "Old Halifax Property",
      addressLine1: "111 Old St",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("properties").set("prop-new", {
      id: "prop-new",
      landlordId: "landlord-2",
      name: "New Halifax Property",
      addressLine1: "222 New St",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("registryRecordsNormalized").set("record-1", {
      id: "record-1",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-1",
      registrationNumber: "REG-1",
      pid: "1234567",
      addressRaw: "222 New St",
      primaryAddressCandidate: "222 new st",
      addressCandidates: ["222 new st"],
      addressNormalized: "222 new st",
      postalCode: null,
      rentalUnitTypeRaw: "Apartment",
      rentalUnitTypeNormalized: "apartment",
      buildingTypeRaw: "Apartment",
      buildingTypeNormalized: "apartment_building",
      registeredUnits: 3,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: "2026-04-01T00:00:00.000Z",
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: [],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-1", {
      id: "halifax_r400_reg-1",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-1",
      normalizedRecordId: "record-1",
      propertyId: "prop-old",
      landlordId: "landlord-1",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-0",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await applyRegistryMatchOverride({
      normalizedRecordId: "record-1",
      action: "ignore",
      reason: "ignore for review",
      actorId: "admin-1",
    });

    const oldProjection = ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-old");
    expect(oldProjection?.registryStatus).toBe("not_found");

    await applyRegistryMatchOverride({
      normalizedRecordId: "record-1",
      action: "attach",
      propertyId: "prop-new",
      reason: "manual attach",
      actorId: "admin-1",
    });

    const match = ensureCollection("registryMatches").get("halifax_r400_reg-1");
    expect(match?.matchStatus).toBe("matched");
    expect(match?.propertyId).toBe("prop-new");

    const newProjection = ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-new");
    expect(newProjection?.registryStatus).toBe("verified");
    expect(newProjection?.registrationNumber).toBe("REG-1");

    const auditEvents = Array.from(ensureCollection("registryAuditLog").values());
    expect(
      auditEvents.some(
        (event) =>
          ["match_overridden", "match_reinstated"].includes(String(event.eventType || "")) &&
          event.propertyId === "prop-new"
      )
    ).toBe(true);

    const propertyReview = await getPropertyRegistryReview("prop-new");
    expect(propertyReview?.projection?.registryStatus).toBe("verified");
  });

  it("detaches a matched record, clears trusted projection state, and audits the detach", async () => {
    const { applyRegistryMatchOverride } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-detach", {
      id: "prop-detach",
      landlordId: "landlord-detach",
      name: "Detach Property",
      addressLine1: "10 Detach Street",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("registryRecordsNormalized").set("record-detach", {
      id: "record-detach",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-detach",
      registrationNumber: "REG-DETACH",
      pid: "1001001",
      addressRaw: "10 DETACH STREET,HALIFAX",
      primaryAddressCandidate: "10 detach st halifax ns",
      addressCandidates: ["10 detach st halifax ns"],
      addressNormalized: "10 detach st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-detach", {
      id: "halifax_r400_reg-detach",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-detach",
      normalizedRecordId: "record-detach",
      propertyId: "prop-detach",
      landlordId: "landlord-detach",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-1",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const result = await applyRegistryMatchOverride({
      normalizedRecordId: "record-detach",
      action: "detach",
      reason: "Wrong property selected",
      actorId: "admin-7",
    });

    expect(result.propertyId).toBeNull();
    expect(result.matchStatus).toBe("unmatched");
    expect(ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-detach")?.registryStatus).toBe("not_found");
    expect(
      Array.from(ensureCollection("registryAuditLog").values()).some(
        (event) => event.eventType === "match_detached" && event.eventData?.previousPropertyId === "prop-detach"
      )
    ).toBe(true);
  });

  it("confirms a possible-match style record attach and refreshes projection plus audit state", async () => {
    const { applyRegistryMatchOverride, getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-possible", {
      id: "prop-possible",
      landlordId: "landlord-3",
      name: "Possible Match Property",
      addressLine1: "6428 Summit Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3L 1S1",
    });
    ensureCollection("registryRecordsNormalized").set("record-possible", {
      id: "record-possible",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-possible",
      registrationNumber: "REG-POSSIBLE",
      pid: "7654321",
      addressRaw: "6420 SUMMIT STREET,6428 SUMMIT STREET,HALIFAX,B3L 1S1",
      primaryAddressCandidate: "6420 summit st halifax ns b3l 1s1",
      addressCandidates: [
        "6420 summit st halifax ns b3l 1s1",
        "6428 summit st halifax ns b3l 1s1",
      ],
      addressNormalized: "6420 summit st halifax ns b3l 1s1",
      postalCode: "B3L1S1",
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 2,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: "2026-04-01T00:00:00.000Z",
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: ["ambiguous_multi_address"],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 2,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-possible", {
      id: "halifax_r400_reg-possible",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-possible",
      normalizedRecordId: "record-possible",
      propertyId: null,
      landlordId: null,
      matchMethod: "address_fuzzy",
      matchScore: 0.82,
      matchStatus: "possible_match",
      mismatchReasons: ["ambiguous_multi_address", "manual_confirmation_recommended"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const updated = await applyRegistryMatchOverride({
      normalizedRecordId: "record-possible",
      action: "attach",
      propertyId: "prop-possible",
      reason: "Confirmed during possible match review",
      actorId: "admin-2",
    });

    expect(updated.matchStatus).toBe("matched");
    expect(updated.propertyId).toBe("prop-possible");

    const propertyReview = await getPropertyRegistryReview("prop-possible", { normalizedRecordId: "record-possible" });
    expect(propertyReview?.projection?.registryStatus).toBe("verified");
    expect(propertyReview?.selectedComparison?.registryPid).toBe("7654321");

    const auditEvents = Array.from(ensureCollection("registryAuditLog").values());
    expect(
      auditEvents.some(
        (event) =>
          event.eventType === "match_overridden" &&
          event.propertyId === "prop-possible" &&
          event.eventData?.action === "attach"
      )
    ).toBe(true);
  });

  it("returns weaker attached candidates to review when a stronger matched record wins projection", async () => {
    const { applyRegistryMatchOverride, getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-winner", {
      id: "prop-winner",
      landlordId: "landlord-winner",
      name: "Winner Property",
      addressLine1: "500 Winner Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H1A1",
    });
    ensureCollection("registryRecordsNormalized").set("record-weak", {
      id: "record-weak",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-weak",
      registrationNumber: "REG-WEAK",
      pid: "5005005",
      addressRaw: "500 WINNER STREET,HALIFAX",
      primaryAddressCandidate: "500 winner st halifax ns",
      addressCandidates: ["500 winner st halifax ns"],
      addressNormalized: "500 winner st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 2,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.9,
      internalDiagnostics: { unmatchedReasons: ["manual_confirmation_recommended"], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryRecordsNormalized").set("record-strong", {
      id: "record-strong",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-strong",
      registrationNumber: "REG-STRONG",
      pid: "5005005",
      addressRaw: "500 WINNER STREET,HALIFAX",
      primaryAddressCandidate: "500 winner st halifax ns",
      addressCandidates: ["500 winner st halifax ns"],
      addressNormalized: "500 winner st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 2,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.96,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-weak", {
      id: "halifax_r400_reg-weak",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-weak",
      normalizedRecordId: "record-weak",
      propertyId: "prop-winner",
      landlordId: "landlord-winner",
      matchMethod: "address_fuzzy",
      matchScore: 0.81,
      matchStatus: "possible_match",
      mismatchReasons: ["manual_confirmation_recommended"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-strong", {
      id: "halifax_r400_reg-strong",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-strong",
      normalizedRecordId: "record-strong",
      propertyId: null,
      landlordId: null,
      matchMethod: "pid_exact",
      matchScore: 0.99,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });

    const updated = await applyRegistryMatchOverride({
      normalizedRecordId: "record-strong",
      action: "attach",
      propertyId: "prop-winner",
      reason: "Confirmed stronger registry match",
      actorId: "admin-strong",
    });

    expect(updated.matchStatus).toBe("matched");
    expect(updated.propertyId).toBe("prop-winner");
    expect(ensureCollection("registryMatches").get("halifax_r400_reg-weak")?.propertyId).toBeNull();
    expect(ensureCollection("registryMatches").get("halifax_r400_reg-weak")?.matchStatus).toBe("possible_match");
    expect(ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-winner")?.registryRecordId).toBe("reg-strong");
    expect(ensureCollection("propertyRegistryStatus").get("halifax_r400_prop-winner")?.registryStatus).toBe("verified");

    const propertyReview = await getPropertyRegistryReview("prop-winner");
    expect(propertyReview?.projection?.registryRecordId).toBe("reg-strong");
    expect(propertyReview?.matches.filter((match) => match.propertyId === "prop-winner")).toHaveLength(1);

    const auditEvents = Array.from(ensureCollection("registryAuditLog").values());
    expect(
      auditEvents.some(
        (event) =>
          event.eventType === "candidate_returned_to_review_due_to_stronger_match" &&
          event.registryRecordId === "reg-weak" &&
          event.eventData?.activeProjectionNormalizedRecordId === "record-strong"
      )
    ).toBe(true);
    expect(
      auditEvents.some(
        (event) =>
          event.eventType === "active_projection_replaced" &&
          event.propertyId === "prop-winner" &&
          Array.isArray(event.eventData?.demotedCandidateNormalizedRecordIds) &&
          event.eventData?.demotedCandidateNormalizedRecordIds?.includes("record-weak")
      )
    ).toBe(true);
  });

  it("requires explicit replacement when a property already has another active source match", async () => {
    const { applyRegistryMatchOverride } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-conflict", {
      id: "prop-conflict",
      landlordId: "landlord-conflict",
      name: "Conflict Property",
      addressLine1: "30 Conflict Street",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("registryRecordsNormalized").set("record-existing", {
      id: "record-existing",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-existing",
      registrationNumber: "REG-EXISTING",
      pid: "3003003",
      addressRaw: "30 CONFLICT STREET,HALIFAX",
      primaryAddressCandidate: "30 conflict st halifax ns",
      addressCandidates: ["30 conflict st halifax ns"],
      addressNormalized: "30 conflict st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryRecordsNormalized").set("record-replacement", {
      id: "record-replacement",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-replacement",
      registrationNumber: "REG-REPLACEMENT",
      pid: "3030303",
      addressRaw: "30 CONFLICT STREET,HALIFAX",
      primaryAddressCandidate: "30 conflict st halifax ns",
      addressCandidates: ["30 conflict st halifax ns"],
      addressNormalized: "30 conflict st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-existing", {
      id: "halifax_r400_reg-existing",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-existing",
      normalizedRecordId: "record-existing",
      propertyId: "prop-conflict",
      landlordId: "landlord-conflict",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-0",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-replacement", {
      id: "halifax_r400_reg-replacement",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-replacement",
      normalizedRecordId: "record-replacement",
      propertyId: null,
      landlordId: null,
      matchMethod: "address_fuzzy",
      matchScore: 0.8,
      matchStatus: "possible_match",
      mismatchReasons: ["manual_confirmation_recommended"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await expect(
      applyRegistryMatchOverride({
        normalizedRecordId: "record-replacement",
        action: "attach",
        propertyId: "prop-conflict",
        reason: "Replace old record",
        actorId: "admin-8",
      })
    ).rejects.toMatchObject({ code: "existing_property_match_conflict", statusCode: 409 });

    const replaced = await applyRegistryMatchOverride({
      normalizedRecordId: "record-replacement",
      action: "attach",
      propertyId: "prop-conflict",
      reason: "Replace old record",
      actorId: "admin-8",
      replaceExistingMatch: true,
    });

    expect(replaced.propertyId).toBe("prop-conflict");
    expect(ensureCollection("registryMatches").get("halifax_r400_reg-existing")?.propertyId).toBeNull();
    expect(
      ["possible_match", "unmatched"].includes(
        String(ensureCollection("registryMatches").get("halifax_r400_reg-existing")?.matchStatus || "")
      )
    ).toBe(true);
  });

  it("filters the review queue by search query alongside status", async () => {
    const { listRegistryReviewQueue } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-search", {
      id: "prop-search",
      landlordId: "landlord-search",
      name: "Harbour View",
      addressLine1: "91 Search Street",
      city: "Halifax",
      province: "NS",
      pid: "9191919",
    });
    ensureCollection("registryRecordsNormalized").set("record-search", {
      id: "record-search",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-search",
      registrationNumber: "REG-SEARCH",
      pid: "9191919",
      addressRaw: "91 SEARCH STREET,HALIFAX",
      primaryAddressCandidate: "91 search st halifax ns",
      addressCandidates: ["91 search st halifax ns"],
      addressNormalized: "91 search st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-search", {
      id: "halifax_r400_reg-search",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-search",
      normalizedRecordId: "record-search",
      propertyId: "prop-search",
      landlordId: "landlord-search",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-1",
      reviewedAt: "2026-04-01T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryRecordsNormalized").set("record-other", {
      id: "record-other",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-other",
      registrationNumber: "REG-OTHER",
      pid: "0000001",
      addressRaw: "12 OTHER STREET,HALIFAX",
      primaryAddressCandidate: "12 other st halifax ns",
      addressCandidates: ["12 other st halifax ns"],
      addressNormalized: "12 other st halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-other", {
      id: "halifax_r400_reg-other",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-other",
      normalizedRecordId: "record-other",
      propertyId: null,
      landlordId: null,
      matchMethod: null,
      matchScore: 0,
      matchStatus: "unmatched",
      mismatchReasons: [],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await expect(listRegistryReviewQueue({ matchStatus: "matched", search: "harbour" })).resolves.toMatchObject({
      items: [expect.any(Object)],
      pageInfo: expect.any(Object),
      summary: expect.any(Object),
    });
    await expect(listRegistryReviewQueue({ matchStatus: "matched", search: "9191919" })).resolves.toMatchObject({
      items: [expect.any(Object)],
    });
    await expect(listRegistryReviewQueue({ matchStatus: "matched", search: "REG-SEARCH" })).resolves.toMatchObject({
      items: [expect.any(Object)],
    });
    await expect(listRegistryReviewQueue({ matchStatus: "matched", search: "other" })).resolves.toMatchObject({
      items: [],
    });
  });

  it("returns paginated queue pages with cursor metadata and summary counts", async () => {
    const { listRegistryReviewQueue } = await import("../registry/registryImportService");

    for (let index = 1; index <= 3; index += 1) {
      const id = `record-page-${index}`;
      ensureCollection("registryRecordsNormalized").set(id, {
        id,
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: `reg-page-${index}`,
        registrationNumber: `REG-PAGE-${index}`,
        pid: `${index}${index}${index}${index}`,
        addressRaw: `${index} Queue Street, Halifax`,
        primaryAddressCandidate: `${index} queue st halifax ns`,
        addressCandidates: [`${index} queue st halifax ns`],
        addressNormalized: `${index} queue st halifax ns`,
        postalCode: null,
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 1,
        numberOfFloors: 1,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: null,
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
        importedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: `2026-04-0${index}T00:00:00.000Z`,
      });
      ensureCollection("registryMatches").set(`halifax_r400_reg-page-${index}`, {
        id: `halifax_r400_reg-page-${index}`,
        sourceKey: "halifax_r400",
        registryRecordId: `reg-page-${index}`,
        normalizedRecordId: id,
        propertyId: null,
        landlordId: null,
        matchMethod: index === 1 ? "manual" : null,
        matchScore: index,
        matchStatus: index === 1 ? "matched" : index === 2 ? "mismatch" : "unmatched",
        mismatchReasons: [],
        reviewedBy: null,
        reviewedAt: null,
        overrideReason: null,
        createdAt: `2026-04-0${index}T00:00:00.000Z`,
        updatedAt: `2026-04-0${index}T00:00:00.000Z`,
      });
    }

    const firstPage = await listRegistryReviewQueue({ pageSize: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.pageInfo.pageSize).toBe(2);
    expect(firstPage.pageInfo.hasMore).toBe(true);
    expect(firstPage.pageInfo.nextCursor).toBeTruthy();
    expect(firstPage.summary.all).toBe(3);
    expect(firstPage.summary.matched).toBe(1);
    expect(firstPage.summary.mismatch).toBe(1);
    expect(firstPage.summary.unmatched).toBe(1);

    const secondPage = await listRegistryReviewQueue({
      pageSize: 2,
      pageCursor: firstPage.pageInfo.nextCursor,
    });
    expect(secondPage.items).toHaveLength(1);
  });

  it("returns stable empty pagination state when no queue items match", async () => {
    const { listRegistryReviewQueue } = await import("../registry/registryImportService");
    await expect(listRegistryReviewQueue({ matchStatus: "ignored", search: "missing", pageSize: 25 })).resolves.toMatchObject({
      items: [],
      pageInfo: {
        pageSize: 25,
        nextCursor: null,
        hasMore: false,
      },
    });
  });

  it("returns queue rows for legacy match docs when summary counts exist and search is blank", async () => {
    const { listRegistryReviewQueue } = await import("../registry/registryImportService");

    ensureCollection("registryMatches").set("halifax_r400_reg-legacy-unmatched", {
      id: "halifax_r400_reg-legacy-unmatched",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-legacy-unmatched",
      normalizedRecordId: "record-legacy-unmatched",
      propertyId: null,
      landlordId: null,
      matchMethod: null,
      matchScore: 0,
      matchStatus: "unmatched",
      mismatchReasons: ["manual_confirmation_recommended"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-legacy-matched", {
      id: "halifax_r400_reg-legacy-matched",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-legacy-matched",
      normalizedRecordId: "record-legacy-matched",
      propertyId: "prop-legacy",
      landlordId: "landlord-legacy",
      matchMethod: "manual",
      matchScore: 1,
      matchStatus: "matched",
      mismatchReasons: [],
      reviewedBy: "admin-1",
      reviewedAt: "2026-04-03T00:00:00.000Z",
      overrideReason: "seed",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    const allResults = await listRegistryReviewQueue({ matchStatus: "all", search: "" });
    expect(allResults.summary.all).toBe(2);
    expect(allResults.summary.unmatched).toBe(1);
    expect(allResults.summary.matched).toBe(1);
    expect(allResults.items).toHaveLength(2);
    expect(allResults.items[0]?.match?.id).toBe("halifax_r400_reg-legacy-matched");
    expect(allResults.items[1]?.match?.id).toBe("halifax_r400_reg-legacy-unmatched");
    expect(allResults.items[0]?.normalizedRecord).toMatchObject({
      id: "record-legacy-matched",
      registryRecordId: "reg-legacy-matched",
    });

    const unmatchedResults = await listRegistryReviewQueue({ matchStatus: "unmatched", search: "   " });
    expect(unmatchedResults.summary.all).toBe(2);
    expect(unmatchedResults.items).toHaveLength(1);
    expect(unmatchedResults.items[0]?.match?.id).toBe("halifax_r400_reg-legacy-unmatched");
  });

  it("renders queue rows from stored queue summary fields without fetching detail-heavy docs", async () => {
    const { listRegistryReviewQueue } = await import("../registry/registryImportService");

    ensureCollection("registryMatches").set("halifax_r400_reg-cached", {
      id: "halifax_r400_reg-cached",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-cached",
      normalizedRecordId: "record-cached",
      propertyId: null,
      landlordId: null,
      matchMethod: "address_fuzzy",
      matchScore: 0.92,
      matchStatus: "possible_match",
      mismatchReasons: ["manual_confirmation_recommended"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-04T00:00:00.000Z",
      queueSummary: {
        displayAddress: "88 Cached Street, Halifax",
        registrationNumber: "REG-CACHED",
        registryPid: "8888888",
        property: null,
        topCandidate: {
          propertyId: "prop-cached",
          propertyName: "Cached Candidate",
          addressLine1: "88 Cached Street",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H1A1",
          pid: "8888888",
          unitCount: 4,
          score: 0.92,
        },
        reasonSummary: ["Manual confirmation is recommended before trusting this match."],
      },
      queueSearchTokens: ["88", "cached", "street", "reg-cached", "8888888"],
    });

    const result = await listRegistryReviewQueue({ matchStatus: "possible_match", search: "cached 8888888" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      match: {
        id: "halifax_r400_reg-cached",
        matchStatus: "possible_match",
      },
      normalizedRecord: {
        id: "record-cached",
        registryRecordId: "reg-cached",
        registrationNumber: "REG-CACHED",
        pid: "8888888",
        addressRaw: "88 Cached Street, Halifax",
      },
      topCandidate: {
        propertyId: "prop-cached",
        propertyName: "Cached Candidate",
      },
    });
  });

  it("returns PID enrichment cues for property review when internal PID is missing", async () => {
    const { getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-review", {
      id: "prop-review",
      landlordId: "landlord-4",
      name: "Review Property",
      addressLine1: "500 Example Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3H 1A1",
      unitCount: 3,
    });
    ensureCollection("registryRecordsNormalized").set("record-review", {
      id: "record-review",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-review",
      registrationNumber: "REG-REVIEW",
      pid: "8888888",
      addressRaw: "500 EXAMPLE STREET,HALIFAX,B3H 1A1",
      primaryAddressCandidate: "500 example st halifax ns b3h 1a1",
      addressCandidates: ["500 example st halifax ns b3h 1a1"],
      addressNormalized: "500 example st halifax ns b3h 1a1",
      postalCode: "B3H1A1",
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: "Apartment",
      buildingTypeNormalized: "apartment_building",
      registeredUnits: 3,
      numberOfFloors: 2,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: "2026-04-01T00:00:00.000Z",
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: ["missing_internal_property_pid"],
        pidSourceFieldsChecked: ["pid", "metadata.pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const propertyReview = await getPropertyRegistryReview("prop-review", { normalizedRecordId: "record-review" });
    expect(propertyReview?.propertyPid).toBe(null);
    expect(propertyReview?.selectedComparison?.pidStatus).toBe("missing_internal_pid");
    expect(propertyReview?.selectedComparison?.operatorPrompts).toContain(
      "Property PID missing; registry record includes PID. Consider updating property data before confirming registry link."
    );
    expect(propertyReview?.selectedComparison?.reasonSummary).toContain(
      "Internal property PID is missing, so PID auto-match could not run."
    );
  });

  it("reports exact and mismatched PID comparison states for property review", async () => {
    const { getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-pid-exact", {
      id: "prop-pid-exact",
      name: "Exact PID Property",
      addressLine1: "10 Exact Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3K 1K1",
      pid: "1111111",
    });
    ensureCollection("properties").set("prop-pid-mismatch", {
      id: "prop-pid-mismatch",
      name: "Mismatch PID Property",
      addressLine1: "20 Mismatch Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3K 1K2",
      pid: "2222222",
    });
    ensureCollection("registryRecordsNormalized").set("record-pid-exact", {
      id: "record-pid-exact",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-pid-exact",
      registrationNumber: "REG-PID-EXACT",
      pid: "1111111",
      addressRaw: "10 EXACT STREET,HALIFAX,B3K 1K1",
      primaryAddressCandidate: "10 exact st halifax ns b3k 1k1",
      addressCandidates: ["10 exact st halifax ns b3k 1k1"],
      addressNormalized: "10 exact st halifax ns b3k 1k1",
      postalCode: "B3K1K1",
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryRecordsNormalized").set("record-pid-mismatch", {
      id: "record-pid-mismatch",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-pid-mismatch",
      registrationNumber: "REG-PID-MISMATCH",
      pid: "3333333",
      addressRaw: "20 MISMATCH STREET,HALIFAX,B3K 1K2",
      primaryAddressCandidate: "20 mismatch st halifax ns b3k 1k2",
      addressCandidates: ["20 mismatch st halifax ns b3k 1k2"],
      addressNormalized: "20 mismatch st halifax ns b3k 1k2",
      postalCode: "B3K1K2",
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: { unmatchedReasons: [], pidSourceFieldsChecked: ["pid"], addressCandidateCount: 1 },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const exactReview = await getPropertyRegistryReview("prop-pid-exact", { normalizedRecordId: "record-pid-exact" });
    const mismatchReview = await getPropertyRegistryReview("prop-pid-mismatch", { normalizedRecordId: "record-pid-mismatch" });

    expect(exactReview?.selectedComparison?.pidStatus).toBe("exact_match");
    expect(exactReview?.selectedComparison?.operatorPrompts).toContain(
      "Internal property PID matches the registry PID exactly."
    );
    expect(mismatchReview?.selectedComparison?.pidStatus).toBe("mismatch");
    expect(mismatchReview?.selectedComparison?.operatorPrompts).toContain(
      "Property PID differs from the registry PID. Manual confirmation is recommended."
    );
  });

  it("updates the canonical property pid from a registry record and audits the change", async () => {
    const { applyRegistryPidToPropertyFromRecord, getPropertyRegistryReview } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-pid-update", {
      id: "prop-pid-update",
      landlordId: "landlord-5",
      name: "PID Update Property",
      addressLine1: "77 Registry Street",
      city: "Halifax",
      province: "NS",
      postalCode: "B3J 2K9",
    });
    ensureCollection("registryRecordsNormalized").set("record-pid-update", {
      id: "record-pid-update",
      importBatchId: "import-1",
      sourceKey: "halifax_r400",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-pid-update",
      registrationNumber: "REG-PID-UPDATE",
      pid: "7777777",
      addressRaw: "77 REGISTRY STREET,HALIFAX,B3J 2K9",
      primaryAddressCandidate: "77 registry st halifax ns b3j 2k9",
      addressCandidates: ["77 registry st halifax ns b3j 2k9"],
      addressNormalized: "77 registry st halifax ns b3j 2k9",
      postalCode: "B3J2K9",
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: 1,
      numberOfFloors: 1,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: "2026-04-01T00:00:00.000Z",
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: ["missing_internal_property_pid"],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });
    ensureCollection("registryMatches").set("halifax_r400_reg-pid-update", {
      id: "halifax_r400_reg-pid-update",
      sourceKey: "halifax_r400",
      registryRecordId: "reg-pid-update",
      normalizedRecordId: "record-pid-update",
      propertyId: null,
      landlordId: null,
      matchMethod: "address_fuzzy",
      matchScore: 0.78,
      matchStatus: "possible_match",
      mismatchReasons: ["missing_internal_property_pid"],
      reviewedBy: null,
      reviewedAt: null,
      overrideReason: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const result = await applyRegistryPidToPropertyFromRecord({
      normalizedRecordId: "record-pid-update",
      propertyId: "prop-pid-update",
      reason: "Apply verified Halifax PID",
      actorId: "admin-9",
    });

    expect(result.changed).toBe(true);
    expect(result.previousPid).toBe(null);
    expect(result.newPid).toBe("7777777");

    const property = ensureCollection("properties").get("prop-pid-update");
    expect(property?.pid).toBe("7777777");

    const refreshedMatch = ensureCollection("registryMatches").get("halifax_r400_reg-pid-update");
    expect(refreshedMatch?.matchStatus).toBe("matched");
    expect(refreshedMatch?.matchMethod).toBe("pid_exact");
    expect(refreshedMatch?.propertyId).toBe("prop-pid-update");

    const propertyReview = await getPropertyRegistryReview("prop-pid-update", { normalizedRecordId: "record-pid-update" });
    expect(propertyReview?.projection?.registryStatus).toBe("verified");
    expect(propertyReview?.propertyPid).toBe("7777777");

    const auditEvents = Array.from(ensureCollection("registryAuditLog").values());
    expect(
      auditEvents.some(
        (event) =>
          event.eventType === "property_pid_updated_from_registry" &&
          event.propertyId === "prop-pid-update" &&
          event.eventData?.previousPid === null &&
          event.eventData?.newPid === "7777777"
      )
    ).toBe(true);
  });

  it("requires explicit confirmation before overwriting a different property pid", async () => {
    const { applyRegistryPidToPropertyFromRecord } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-pid-overwrite", {
      id: "prop-pid-overwrite",
      name: "Overwrite Property",
      addressLine1: "9 Overwrite Lane",
      city: "Halifax",
      province: "NS",
      pid: "1111111",
    });
    ensureCollection("registryRecordsNormalized").set("record-pid-overwrite", {
      id: "record-pid-overwrite",
      sourceKey: "halifax_r400",
      importBatchId: "import-1",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-pid-overwrite",
      registrationNumber: "REG-PID-OVERWRITE",
      pid: "9999999",
      addressRaw: "9 OVERWRITE LANE,HALIFAX",
      primaryAddressCandidate: "9 overwrite ln halifax ns",
      addressCandidates: ["9 overwrite ln halifax ns"],
      addressNormalized: "9 overwrite ln halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: null,
      numberOfFloors: null,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: [],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await expect(
      applyRegistryPidToPropertyFromRecord({
        normalizedRecordId: "record-pid-overwrite",
        propertyId: "prop-pid-overwrite",
        reason: "Attempt overwrite",
        actorId: "admin-1",
      })
    ).rejects.toMatchObject({ code: "pid_update_confirmation_required", statusCode: 409 });

    expect(ensureCollection("properties").get("prop-pid-overwrite")?.pid).toBe("1111111");

    await expect(
      applyRegistryPidToPropertyFromRecord({
        normalizedRecordId: "record-pid-overwrite",
        propertyId: "prop-pid-overwrite",
        reason: "Confirmed overwrite",
        actorId: "admin-1",
        confirmOverwrite: true,
      })
    ).resolves.toMatchObject({ changed: true, newPid: "9999999" });

    expect(ensureCollection("properties").get("prop-pid-overwrite")?.pid).toBe("9999999");
  });

  it("rejects pid updates when the selected registry record does not include a pid", async () => {
    const { applyRegistryPidToPropertyFromRecord } = await import("../registry/registryImportService");

    ensureCollection("properties").set("prop-no-pid", {
      id: "prop-no-pid",
      name: "No PID Property",
      addressLine1: "12 No PID Avenue",
      city: "Halifax",
      province: "NS",
    });
    ensureCollection("registryRecordsNormalized").set("record-no-pid", {
      id: "record-no-pid",
      sourceKey: "halifax_r400",
      importBatchId: "import-1",
      jurisdictionCountry: "CA",
      jurisdictionProvince: "NS",
      jurisdictionMunicipality: "Halifax",
      registryCategory: "rental_registry",
      registryRecordId: "reg-no-pid",
      registrationNumber: "REG-NO-PID",
      pid: null,
      addressRaw: "12 NO PID AVENUE,HALIFAX",
      primaryAddressCandidate: "12 no pid ave halifax ns",
      addressCandidates: ["12 no pid ave halifax ns"],
      addressNormalized: "12 no pid ave halifax ns",
      postalCode: null,
      rentalUnitTypeRaw: null,
      rentalUnitTypeNormalized: null,
      buildingTypeRaw: null,
      buildingTypeNormalized: null,
      registeredUnits: null,
      numberOfFloors: null,
      sharedFacilities: null,
      registrationStatusRaw: "Y",
      registrationStatusNormalized: "registered",
      registrationIssuedAt: null,
      lat: null,
      lng: null,
      sourceConfidence: 0.94,
      internalDiagnostics: {
        unmatchedReasons: [],
        pidSourceFieldsChecked: ["pid"],
        addressCandidateCount: 1,
      },
      importedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    await expect(
      applyRegistryPidToPropertyFromRecord({
        normalizedRecordId: "record-no-pid",
        propertyId: "prop-no-pid",
        reason: "Cannot update",
        actorId: "admin-2",
      })
    ).rejects.toMatchObject({ code: "missing_registry_pid", statusCode: 400 });

    expect(ensureCollection("properties").get("prop-no-pid")?.pid).toBeUndefined();
  });

  it("normalizes Halifax fields using the adapter contract", async () => {
    const { HalifaxR400Adapter } = await import("../registry/adapters/HalifaxR400Adapter");
    const adapter = new HalifaxR400Adapter();
    const source = adapter.getSourceDefinition();
    const importRecord = {
      id: "import-1",
      sourceKey: "halifax_r400",
      sourceFileName: "halifax.csv",
      sourceFileStoragePath: null,
      importBatchId: "import-1",
      rowCount: 1,
      parsedRowCount: 1,
      normalizedRowCount: 0,
      matchedRowCount: 0,
      unmatchedRowCount: 0,
      mismatchRowCount: 0,
      ignoredRowCount: 0,
      skippedRowCount: 0,
      status: "processing" as const,
      errorSummary: null,
      diagnostics: {
        missingPidCount: 0,
        missingAddressCount: 0,
        unsupportedStatusCount: 0,
        invalidNumericFieldCount: 0,
        duplicateRowHashCount: 0,
      },
      startedAt: "2026-04-03T00:00:00.000Z",
      completedAt: null,
      createdBy: "admin-1",
      createdAt: "2026-04-03T00:00:00.000Z",
    };
    const parsed = adapter.parse(
      'OBJECTID,Registration Number,PID,Address,Rental Unit Type,Building Type,Registered Units,Number of Floors,Shared Facilities,Registered,Date Registration Issued,GlobalID,x,y\n1,REG-22,1234567,"123 Example Street, Halifax",Apartment,Apartment,4,3,Yes,Y,2026-03-12,glob-1,-63.57,44.64'
    );
    const raw = adapter.mapRawRow(parsed[0], 0, {
      importRecord,
      source,
      importedAt: "2026-04-03T00:00:00.000Z",
    });
    const normalized = adapter.normalizeRawRow(raw, {
      importRecord,
      source,
      importedAt: "2026-04-03T00:00:00.000Z",
    });

    expect(normalized.registryRecordId).toBe("REG-22");
    expect(normalized.pid).toBe("1234567");
    expect(normalized.registrationStatusNormalized).toBe("registered");
    expect(normalized.addressNormalized).toContain("123 example st");
    expect(normalized.addressCandidates).toEqual(expect.arrayContaining([normalized.addressNormalized]));
  });
});
