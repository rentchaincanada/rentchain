import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportExport, getExportPdfBuffer, getReportExport, validateToken } from "../screening/reportExportService";

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
          set: async (payload: Record<string, unknown>) => {
            collection.set(docId, payload);
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

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: vi.fn(() => {
    throw new Error("no bucket");
  }),
}));

describe("report export service", () => {
  beforeEach(() => {
    collectionStore.clear();
  });

  it("creates export doc and validates token", async () => {
    const pdfBuffer = Buffer.from("pdfdata");
    const result = await createReportExport({
      applicationId: "app_1",
      landlordId: "land_1",
      resultId: "res_1",
      pdfBuffer,
    });

    const exportDoc = await getReportExport(result.exportId);
    expect(exportDoc?.applicationId).toBe("app_1");
    expect(exportDoc?.status).toBe("ready");
    expect(exportDoc?.tokenHash).toBeTruthy();
    expect(exportDoc?.pdfBase64).toBeTruthy();

    expect(validateToken(exportDoc, result.token)).toBe(true);
    expect(validateToken(exportDoc, "badtoken")).toBe(false);

    const buffer = await getExportPdfBuffer(exportDoc);
    expect(buffer?.toString()).toBe("pdfdata");
  });
});
