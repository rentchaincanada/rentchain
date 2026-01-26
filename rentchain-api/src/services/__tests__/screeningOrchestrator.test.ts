import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginScreening, markScreeningComplete } from "../screening/screeningOrchestrator";

const { collectionStore, dbMock } = vi.hoisted(() => {
  const collectionStore = new Map<string, Map<string, any>>();
  let autoId = 0;

  const getCollection = (name: string) => {
    if (!collectionStore.has(name)) {
      collectionStore.set(name, new Map());
    }
    return collectionStore.get(name)!;
  };

  const dbMock = {
    collection: vi.fn((name: string) => ({
      doc: (id?: string) => {
        const collection = getCollection(name);
        const docId = id || `auto_${++autoId}`;
        return {
          id: docId,
          get: async () => ({
            exists: collection.has(docId),
            data: () => collection.get(docId),
          }),
          set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
            const existing = collection.get(docId) || {};
            collection.set(docId, options?.merge ? { ...existing, ...payload } : payload);
          },
        };
      },
    })),
  };

  return { collectionStore, dbMock };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("screening orchestrator", () => {
  beforeEach(() => {
    collectionStore.clear();
  });

  it("begins screening only from paid state", async () => {
    const apps = new Map<string, any>();
    collectionStore.set("rentalApplications", apps);
    apps.set("app_paid", { screeningStatus: "paid" });
    apps.set("app_new", { screeningStatus: "unpaid" });

    const ok = await beginScreening("app_paid");
    const bad = await beginScreening("app_new");

    expect(ok.ok).toBe(true);
    expect(apps.get("app_paid")?.screeningStatus).toBe("processing");
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe("invalid_state");
  });

  it("marks screening complete and writes result", async () => {
    const apps = new Map<string, any>();
    collectionStore.set("rentalApplications", apps);
    apps.set("app_1", { landlordId: "land_1", screeningStatus: "processing", screeningProvider: "manual" });

    const result = await markScreeningComplete("app_1", {
      summary: { overall: "pass" },
      reportText: "Screening finished.",
    });

    expect(result.ok).toBe(true);
    expect(result.resultId).toBeTruthy();
    const updated = apps.get("app_1");
    expect(updated.screeningStatus).toBe("complete");
    expect(updated.screeningResultId).toBe(result.resultId);

    const results = collectionStore.get("screeningResults");
    const stored = results?.get(result.resultId as string);
    expect(stored?.summary?.overall).toBe("pass");
    expect(stored?.reportText).toBe("Screening finished.");
  });
});
