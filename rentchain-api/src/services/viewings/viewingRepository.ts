import { db } from "../../firebase";
import type { ViewingOwnershipContext, ViewingRequestDoc } from "./viewingTypes";

const VIEWING_REQUESTS_COLLECTION = "viewingRequests";
const TENANT_NOTIFICATIONS_COLLECTION = "tenantNotifications";
const VIEWING_REQUEST_EVENTS_COLLECTION = "viewingRequestEvents";

function collection() {
  return db.collection(VIEWING_REQUESTS_COLLECTION);
}

export async function createViewingRequestDoc(doc: ViewingRequestDoc): Promise<ViewingRequestDoc> {
  await collection().doc(doc.id).set(doc, { merge: true });
  return doc;
}

export async function saveViewingRequestDoc(doc: ViewingRequestDoc): Promise<ViewingRequestDoc> {
  await collection().doc(doc.id).set(doc, { merge: true });
  return doc;
}

export async function saveViewingRequestWithNotification(input: {
  viewingRequest: ViewingRequestDoc;
  notification: Record<string, any>;
  auditEvent: Record<string, any>;
}): Promise<ViewingRequestDoc> {
  const viewingRef = collection().doc(input.viewingRequest.id);
  const notificationRef = db.collection(TENANT_NOTIFICATIONS_COLLECTION).doc(input.notification.id);
  const auditRef = db.collection(VIEWING_REQUEST_EVENTS_COLLECTION).doc(input.auditEvent.id);

  if (typeof (db as any).runTransaction === "function") {
    await (db as any).runTransaction(async (transaction: any) => {
      const notificationSnap = await transaction.get(notificationRef);
      const auditSnap = await transaction.get(auditRef);
      transaction.set(viewingRef, input.viewingRequest, { merge: true });
      if (!notificationSnap.exists) transaction.set(notificationRef, input.notification);
      if (!auditSnap.exists) transaction.set(auditRef, input.auditEvent);
    });
    return input.viewingRequest;
  }

  const notificationSnap = await notificationRef.get();
  const auditSnap = await auditRef.get();
  await viewingRef.set(input.viewingRequest, { merge: true });
  if (!notificationSnap.exists) await notificationRef.set(input.notification);
  if (!auditSnap.exists) await auditRef.set(input.auditEvent);
  return input.viewingRequest;
}

export async function getViewingRequestDoc(viewingRequestId: string): Promise<ViewingRequestDoc | null> {
  const snap = await collection().doc(viewingRequestId).get();
  if (!snap.exists) return null;
  return snap.data() as ViewingRequestDoc;
}

export async function listViewingRequestDocsByLandlord(
  landlordId: string
): Promise<ViewingRequestDoc[]> {
  const snap = await collection().where("landlordId", "==", landlordId).get();
  return snap.docs.map((doc) => doc.data() as ViewingRequestDoc);
}

export function newViewingRequestId(): string {
  return collection().doc().id;
}

async function getPropertyDoc(propertyId: string) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) return null;
  return snap.data() as any;
}

async function getUnitDoc(unitId: string) {
  const snap = await db.collection("units").doc(unitId).get();
  if (!snap.exists) return null;
  return snap.data() as any;
}

export async function resolveViewingOwnershipContext(params: {
  propertyId?: string | null;
  unitId?: string | null;
}): Promise<ViewingOwnershipContext> {
  let propertyId = params.propertyId ? String(params.propertyId).trim() : null;
  const unitId = params.unitId ? String(params.unitId).trim() : null;
  let landlordId: string | null = null;

  if (unitId) {
    const unit = await getUnitDoc(unitId);
    if (unit) {
      landlordId = unit.landlordId ? String(unit.landlordId).trim() : landlordId;
      propertyId = propertyId || (unit.propertyId ? String(unit.propertyId).trim() : null);
    }
  }

  if (propertyId) {
    const property = await getPropertyDoc(propertyId);
    if (property) {
      landlordId = property.landlordId ? String(property.landlordId).trim() : landlordId;
    }
  }

  return {
    landlordId: landlordId || null,
    propertyId: propertyId || null,
    unitId: unitId || null,
  };
}
