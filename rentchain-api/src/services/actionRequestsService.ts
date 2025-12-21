import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import {
  ActionRequestStatus,
  PropertyActionRequest,
} from "../types/models";

function toIso(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (typeof value === "string") return value;
  return new Date(value).toISOString();
}

function mapDoc(
  doc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
): PropertyActionRequest {
  const data = doc.data() as any;
  return {
    id: data.id ?? doc.id,
    landlordId: data.landlordId,
    propertyId: data.propertyId,
    unitId: data.unitId,
    tenantId: data.tenantId,
    source: data.source,
    issueType: data.issueType,
    severity: data.severity,
    location: data.location,
    description: data.description,
    status: data.status,
    reportedAt: toIso(data.reportedAt),
    acknowledgedAt: data.acknowledgedAt ? toIso(data.acknowledgedAt) : undefined,
    resolvedAt: data.resolvedAt ? toIso(data.resolvedAt) : undefined,
    resolutionNote: data.resolutionNote,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function createActionRequest(input: {
  landlordId: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  source: "tenant" | "landlord";
  issueType: string;
  severity: string;
  location: "unit" | "building";
  description: string;
}): Promise<PropertyActionRequest> {
  const ref = db.collection("actionRequests").doc();
  const now = FieldValue.serverTimestamp();

  const payload: any = {
    id: ref.id,
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    source: input.source,
    issueType: input.issueType,
    severity: input.severity,
    location: input.location,
    description: input.description,
    status: "new" as ActionRequestStatus,
    reportedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  if (input.unitId) {
    payload.unitId = input.unitId;
  }

  if (input.tenantId) {
    payload.tenantId = input.tenantId;
  }

  await ref.set(payload);

  const snap = await ref.get();
  return mapDoc(snap);
}

export async function listActionRequests(params: {
  landlordId?: string;
  propertyId?: string;
  status?: ActionRequestStatus;
}): Promise<PropertyActionRequest[]> {
  const col = db.collection("actionRequests");
  let query: FirebaseFirestore.Query = col;

  if (params.landlordId) {
    query = query.where("landlordId", "==", params.landlordId);
  }

  if (params.propertyId) {
    query = query.where("propertyId", "==", params.propertyId);
  }

  if (params.status) {
    query = query.where("status", "==", params.status);
  }

  const snap = await query.get();
  if (snap.empty) return [];
  return snap.docs.map(mapDoc);
}

export async function getActionRequestById(
  landlordId: string,
  id: string
): Promise<PropertyActionRequest | null> {
  const ref = db.collection("actionRequests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = mapDoc(snap);
  if (data.landlordId !== landlordId) return null;
  return data;
}

export async function acknowledgeActionRequest(
  landlordId: string,
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  const ref = db.collection("actionRequests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Not found");
  }
  const current = mapDoc(snap);
  if (current.landlordId !== landlordId) {
    throw new Error("Forbidden");
  }

  const nextStatus: ActionRequestStatus =
    current.status === "resolved" ? "resolved" : "acknowledged";

  await ref.update({
    status: nextStatus,
    acknowledgedAt: FieldValue.serverTimestamp(),
    resolutionNote: note ?? current.resolutionNote ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnap = await ref.get();
  return mapDoc(updatedSnap);
}

export async function resolveActionRequest(
  landlordId: string,
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  const ref = db.collection("actionRequests").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Not found");
  }
  const current = mapDoc(snap);
  if (current.landlordId !== landlordId) {
    throw new Error("Forbidden");
  }

  await ref.update({
    status: "resolved",
    resolvedAt: FieldValue.serverTimestamp(),
    resolutionNote: note ?? current.resolutionNote ?? null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnap = await ref.get();
  return mapDoc(updatedSnap);
}
