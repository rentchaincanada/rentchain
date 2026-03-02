import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "stream";
import { createReportExport, getExportPdfBuffer, getReportExport, validateToken } from "../screening/reportExportService";

const { collectionStore, dbMock, uploadBufferToGcsMock, getFileReadStreamMock } = vi.hoisted(() => {
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

  const uploadBufferToGcsMock = vi.fn(async ({ path }: { path: string }) => ({
    path,
    bucket: "test-bucket",
  }));

  const getFileReadStreamMock = vi.fn(({ path }: { path: string }) => {
    return Readable.from([Buffer.from(`pdf:${path}`)]);
  });

  return { collectionStore, dbMock, uploadBufferToGcsMock, getFileReadStreamMock };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: uploadBufferToGcsMock,
}));

vi.mock("../../lib/gcsRead", () => ({
  getFileReadStream: getFileReadStreamMock,
}));

describe("report export service", () => {
  beforeEach(() => {
    collectionStore.clear();
    uploadBufferToGcsMock.mockClear();
    getFileReadStreamMock.mockClear();
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
    expect(exportDoc?.storageBucket).toBe("test-bucket");
    expect(exportDoc?.storagePath).toBe(`screening-exports/${result.exportId}.pdf`);

    expect(validateToken(exportDoc, result.token)).toBe(true);
    expect(validateToken(exportDoc, "badtoken")).toBe(false);

    const buffer = await getExportPdfBuffer(exportDoc);
    expect(buffer?.toString()).toBe(`pdf:screening-exports/${result.exportId}.pdf`);
    expect(uploadBufferToGcsMock).toHaveBeenCalledTimes(1);
    expect(getFileReadStreamMock).toHaveBeenCalledTimes(1);
  });
});
