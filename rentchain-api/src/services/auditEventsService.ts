import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { AuditEvent } from "../types/events";

const db = getFirestore();

export async function logAuditEvent(
  input: Omit<AuditEvent, "id" | "createdAt">
): Promise<void> {
  const ref = db.collection("events").doc();
  const nowIso = new Date().toISOString();
  await ref.set({
    ...input,
    id: ref.id,
    createdAt: FieldValue.serverTimestamp(),
    occurredAt: input.occurredAt ?? nowIso,
  });
}

export async function getEventsForApplication(
  landlordId: string,
  applicationId: string
): Promise<AuditEvent[]> {
  try {
    const snap = await db
      .collection("events")
      .where("landlordId", "==", landlordId)
      .where("applicationId", "==", applicationId)
      .orderBy("occurredAt", "desc")
      .get();

    if (snap.empty) return [];

    return snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: data.id ?? doc.id,
        landlordId: data.landlordId,
        actorUserId: data.actorUserId,
        type: data.type,
        applicationId: data.applicationId,
        tenantId: data.tenantId,
        screeningId: data.screeningId,
        payload: data.payload,
        occurredAt: toIso(data.occurredAt),
        createdAt: toIso(data.createdAt),
      };
    });
  } catch (err) {
    console.error("[auditEventsService] getEventsForApplication error", err);
    return [];
  }
}

export async function getEvents(params: {
  landlordId: string;
  applicationId?: string;
  tenantId?: string;
  propertyId?: string;
  limit?: number;
}): Promise<AuditEvent[]> {
  const { landlordId, applicationId, tenantId, propertyId } = params;
  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : 25;

  try {
    let query: FirebaseFirestore.Query = db
      .collection("events")
      .where("landlordId", "==", landlordId)
      .orderBy("occurredAt", "desc")
      .limit(limit);

    if (applicationId) {
      query = query.where("applicationId", "==", applicationId);
    }

    if (tenantId) {
      query = query.where("tenantId", "==", tenantId);
    }

    if (propertyId) {
      query = query.where("propertyId", "==", propertyId);
    }

    const snap = await query.get();
    if (snap.empty) return [];

    return snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: data.id ?? doc.id,
        landlordId: data.landlordId,
        actorUserId: data.actorUserId,
        type: data.type,
        applicationId: data.applicationId,
        tenantId: data.tenantId,
        propertyId: data.propertyId,
        screeningId: data.screeningId,
        payload: data.payload,
        occurredAt: toIso(data.occurredAt),
        createdAt: toIso(data.createdAt),
      };
    });
  } catch (err) {
    console.error("[auditEventsService] getEvents error", err);
    return [];
  }
}

function toIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date(value).toISOString();
}
