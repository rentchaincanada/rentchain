import { v4 as uuidv4 } from "uuid";
import { db } from "../firebase";

export type AuditEntityType =
  | "tenant"
  | "property"
  | "application"
  | "payment"
  | "system";

export type AuditEventKind =
  | "application.status_changed"
  | "application.converted_to_tenant"
  | "tenant.payment_edited"
  | "tenant.payment_deleted"
  | "ledger.adjustment"
  | "system.info"
  | "screening.viewed";

export interface AuditEvent {
  id: string;
  entityType: AuditEntityType;
  entityId: string;

  tenantId?: string | null;
  propertyId?: string | null;
  applicationId?: string | null;
  paymentId?: string | null;

  kind: AuditEventKind;
  timestamp: string; // ISO string
  summary: string;
  detail?: string | null;
  meta?: Record<string, any> | null;
}

const EVENTS_COLLECTION = "events";

export async function recordAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp"> & { timestamp?: string }
): Promise<AuditEvent> {
  const id = uuidv4();
  const timestamp = event.timestamp || new Date().toISOString();

  const full: AuditEvent = {
    id,
    timestamp,
    ...event,
  };

  await db.collection(EVENTS_COLLECTION).doc(id).set(full);
  return full;
}

export async function getRecentEvents(limit = 50): Promise<AuditEvent[]> {
  const snapshot = await db
    .collection(EVENTS_COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  const events: AuditEvent[] = [];
  snapshot.forEach((doc: any) => {
    events.push(doc.data() as AuditEvent);
  });
  return events;
}

export async function getEventsForTenant(
  tenantId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const snapshot = await db
    .collection(EVENTS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  const events: AuditEvent[] = [];
  snapshot.forEach((doc: any) => {
    events.push(doc.data() as AuditEvent);
  });
  return events;
}

export async function getEventsForProperty(
  propertyId: string,
  limit = 50
): Promise<AuditEvent[]> {
  const snapshot = await db
    .collection(EVENTS_COLLECTION)
    .where("propertyId", "==", propertyId)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  const events: AuditEvent[] = [];
  snapshot.forEach((doc: any) => {
    events.push(doc.data() as AuditEvent);
  });
  return events;
}

export async function getAuditEventById(
  eventId: string
): Promise<AuditEvent | null> {
  const doc = await db.collection(EVENTS_COLLECTION).doc(eventId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as AuditEvent;
}
