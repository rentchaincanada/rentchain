import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type IndexField = { fieldPath: string; order: string };
type CompositeIndex = {
  collectionGroup: string;
  queryScope: string;
  fields: IndexField[];
};

const manifest = JSON.parse(
  readFileSync(new URL("../../../firestore.indexes.json", import.meta.url), "utf8")
) as { indexes: CompositeIndex[] };

function expectIndex(collectionGroup: string, fields: IndexField[]) {
  expect(manifest.indexes).toContainEqual({
    collectionGroup,
    queryScope: "COLLECTION",
    fields,
  });
}

describe("tenant detail Firestore indexes", () => {
  it("declares the tenant-scoped ledgerEventsV2 query index", () => {
    expectIndex("ledgerEventsV2", [
      { fieldPath: "landlordId", order: "ASCENDING" },
      { fieldPath: "tenantId", order: "ASCENDING" },
      { fieldPath: "occurredAt", order: "DESCENDING" },
      { fieldPath: "__name__", order: "DESCENDING" },
    ]);
  });

  it("declares the tenantEvents timeline query index", () => {
    expectIndex("tenantEvents", [
      { fieldPath: "landlordId", order: "ASCENDING" },
      { fieldPath: "tenantId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
      { fieldPath: "__name__", order: "DESCENDING" },
    ]);
  });
});
