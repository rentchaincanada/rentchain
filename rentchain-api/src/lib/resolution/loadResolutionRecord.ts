import { db } from "../../config/firebase";
import type { ResolutionRecordV1, ResolutionStatus } from "./resolutionTypes";

export const ADMIN_RESOLUTIONS_COLLECTION = "adminResolutions";

const ACTIVE_STATUSES = new Set<ResolutionStatus>(["open", "acknowledged", "in_progress"]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function parseTimestamp(value: unknown) {
  const raw = asString(value, 200);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareRecordsDescending(a: ResolutionRecordV1, b: ResolutionRecordV1) {
  const aTs = parseTimestamp(a.updatedAt || a.createdAt);
  const bTs = parseTimestamp(b.updatedAt || b.createdAt);
  if (bTs !== aTs) return bTs - aTs;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

export async function loadAllResolutionRecords(): Promise<ResolutionRecordV1[]> {
  const snap = await db.collection(ADMIN_RESOLUTIONS_COLLECTION).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as ResolutionRecordV1);
}

export async function loadResolutionRecord(input: {
  resourceType: string;
  resourceId: string;
  reasonCode?: string | null;
}): Promise<ResolutionRecordV1 | null> {
  const resourceType = asString(input.resourceType, 120);
  const resourceId = asString(input.resourceId, 240);
  const reasonCode = asString(input.reasonCode, 160);
  if (!resourceType || !resourceId) return null;

  const records = (await loadAllResolutionRecords())
    .filter(
      (record) =>
        asString(record.resource?.type, 120) === resourceType &&
        asString(record.resource?.id, 240) === resourceId &&
        (!reasonCode || asString(record.triage?.reasonCode, 160) === reasonCode)
    )
    .sort(compareRecordsDescending);

  const active = records.find((record) => ACTIVE_STATUSES.has(record.status));
  return active || records[0] || null;
}
