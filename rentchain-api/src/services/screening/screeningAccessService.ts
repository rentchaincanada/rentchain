import admin from "firebase-admin";
import { db } from "../../firebase";
import { getScreeningHistoryDetail } from "./screeningHistoryService";

export type ScreeningReportAccessResult =
  | {
      ok: true;
      bucket: string;
      objectKey: string;
      filename: string;
      contentType: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function resolveScreeningReportAccess(params: {
  landlordId: string;
  screeningId: string;
}): Promise<ScreeningReportAccessResult> {
  const detail = await getScreeningHistoryDetail(params);
  if (!detail) {
    return { ok: false, status: 404, error: "SCREENING_NOT_FOUND" };
  }

  if (detail.report.status !== "available" || detail.report.storageMode !== "rentchain_encrypted") {
    return { ok: false, status: 409, error: "REPORT_UNAVAILABLE" };
  }

  const sourceId = detail.metadata.sourceId;
  const orderSnap = await db.collection("screeningOrders").doc(sourceId).get();
  if (!orderSnap.exists) {
    return { ok: false, status: 404, error: "REPORT_NOT_FOUND" };
  }
  const order = orderSnap.data() as any;
  if (!order?.reportBucket || !order?.reportObjectKey) {
    return { ok: false, status: 409, error: "REPORT_UNAVAILABLE" };
  }

  return {
    ok: true,
    bucket: String(order.reportBucket),
    objectKey: String(order.reportObjectKey),
    filename: `screening-report-${detail.id}.pdf`,
    contentType: "application/pdf",
  };
}

export async function downloadScreeningReportBuffer(params: {
  bucket: string;
  objectKey: string;
}): Promise<Buffer> {
  const [buffer] = await admin.storage().bucket(params.bucket).file(params.objectKey).download();
  return buffer;
}
