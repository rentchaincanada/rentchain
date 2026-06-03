import { db } from "../../firebase";
import type { RegistryAuditEventType, RegistrySourceKey } from "./registryTypes";
import { compactObject, nowIso } from "./registryUtils";

export async function recordRegistryAuditEvent(input: {
  sourceKey: RegistrySourceKey;
  importBatchId?: string | null;
  registryRecordId?: string | null;
  propertyId?: string | null;
  actorType: "system" | "admin";
  actorId?: string | null;
  eventType: RegistryAuditEventType;
  eventData?: Record<string, unknown>;
}) {
  const createdAt = nowIso();
  await db.collection("registryAuditLog").add({
    sourceKey: input.sourceKey,
    importBatchId: input.importBatchId || null,
    registryRecordId: input.registryRecordId || null,
    propertyId: input.propertyId || null,
    actorType: input.actorType,
    actorId: input.actorId || null,
    eventType: input.eventType,
    eventData: compactObject(input.eventData || {}),
    createdAt,
  });
}
