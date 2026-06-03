import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getScreeningHistoryDetail: vi.fn(),
  downloadMock: vi.fn(),
  bucketMock: vi.fn(),
  dbMock: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({
          exists: true,
          data: () => ({ reportBucket: "bucket", reportObjectKey: "path/report.pdf" }),
        })),
      })),
    })),
  },
}));

vi.mock("../screening/screeningHistoryService", () => ({
  getScreeningHistoryDetail: mocks.getScreeningHistoryDetail,
}));

vi.mock("../../firebase", () => ({
  db: mocks.dbMock,
}));

vi.mock("firebase-admin", () => ({
  default: {
    storage: () => ({
      bucket: mocks.bucketMock,
    }),
  },
}));

import { downloadScreeningReportBuffer, resolveScreeningReportAccess } from "../screening/screeningAccessService";

describe("screeningAccessService", () => {
  beforeEach(() => {
    mocks.getScreeningHistoryDetail.mockReset();
    mocks.downloadMock.mockReset();
    mocks.bucketMock.mockReset();
    mocks.bucketMock.mockReturnValue({
      file: () => ({
        download: mocks.downloadMock,
      }),
    });
  });

  it("resolves report access only for available encrypted reports", async () => {
    mocks.getScreeningHistoryDetail.mockResolvedValue({
      id: "order_1",
      metadata: { sourceId: "order_1", sourceType: "order" },
      report: {
        status: "available",
        storageMode: "rentchain_encrypted",
      },
    });

    const access = await resolveScreeningReportAccess({
      landlordId: "landlord_1",
      screeningId: "order_1",
    });

    expect(access).toMatchObject({
      ok: true,
      bucket: "bucket",
      objectKey: "path/report.pdf",
    });
  });

  it("downloads the report buffer through admin storage", async () => {
    mocks.downloadMock.mockResolvedValue([Buffer.from("pdf-bytes")]);

    const buffer = await downloadScreeningReportBuffer({
      bucket: "secure-bucket",
      objectKey: "reports/a.pdf",
    });

    expect(mocks.bucketMock).toHaveBeenCalledWith("secure-bucket");
    expect(buffer.toString()).toBe("pdf-bytes");
  });
});
