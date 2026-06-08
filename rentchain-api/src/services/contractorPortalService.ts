import { db } from "../firebase";

export type ContractorWorkOrderStatus =
  | "assigned"
  | "accepted"
  | "scheduled"
  | "in_progress"
  | "needs_clarification"
  | "on_hold"
  | "completed";

const STATUSES = new Set<ContractorWorkOrderStatus>([
  "assigned",
  "accepted",
  "scheduled",
  "in_progress",
  "needs_clarification",
  "on_hold",
  "completed",
]);

const TRANSITIONS: Record<ContractorWorkOrderStatus, ContractorWorkOrderStatus[]> = {
  assigned: ["accepted", "scheduled", "in_progress", "needs_clarification", "on_hold", "completed"],
  accepted: ["scheduled", "in_progress", "needs_clarification", "on_hold", "completed"],
  scheduled: ["in_progress", "needs_clarification", "on_hold", "completed"],
  in_progress: ["needs_clarification", "on_hold", "completed"],
  needs_clarification: ["scheduled", "in_progress", "on_hold", "completed"],
  on_hold: ["scheduled", "in_progress", "needs_clarification", "completed"],
  completed: [],
};

function asString(value: unknown, max = 1000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 1000): string | null {
  const next = asString(value, max);
  return next || null;
}

function uniqueStrings(value: unknown, max = 30): string[] {
  if (!Array.isArray(value)) return [];
  const next = new Set<string>();
  for (const item of value) {
    const normalized = asString(item, 120);
    if (normalized) next.add(normalized);
    if (next.size >= max) break;
  }
  return Array.from(next);
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function normalizeStatus(value: unknown): ContractorWorkOrderStatus {
  const normalizedRaw = asString(value, 80).toLowerCase().replace(/\s+/g, "_");
  if (normalizedRaw === "blocked") return "needs_clarification";
  const normalized = normalizedRaw as ContractorWorkOrderStatus;
  if (STATUSES.has(normalized)) return normalized;
  return "assigned";
}

function propertyLabel(workOrder: any): string {
  return (
    asOptionalString(workOrder?.propertyName, 180) ||
    asOptionalString(workOrder?.propertyLabel, 180) ||
    asOptionalString(workOrder?.propertySlug, 180) ||
    "Assigned property"
  );
}

function unitLabel(workOrder: any): string | null {
  return asOptionalString(workOrder?.unitLabel, 120) || asOptionalString(workOrder?.unitName, 120);
}

function projectContractorMessage(message: any, workOrderId?: string | null) {
  return {
    id: asString(message?.id, 160),
    workOrderId: asString(workOrderId || message?.workOrderId, 160),
    senderRole: asOptionalString(message?.senderRole, 40),
    senderName: asOptionalString(message?.senderName, 180),
    text: asOptionalString(message?.text, 2000) || "",
    createdAt: toMillis(message?.createdAtMs || message?.createdAt),
  };
}

function projectWorkOrder(workOrderId: string, workOrder: any, extras?: { updates?: any[]; messages?: any[] }) {
  const assignment = workOrder?.contractorAssignment && typeof workOrder.contractorAssignment === "object"
    ? workOrder.contractorAssignment
    : {};
  return {
    id: workOrderId,
    workOrderId,
    maintenanceRequestId: asOptionalString(workOrder?.maintenanceRequestId, 160),
    title: asOptionalString(workOrder?.title, 240) || "Assigned work order",
    description: asOptionalString(workOrder?.description, 4000) || "",
    category: asOptionalString(workOrder?.category, 120) || "general",
    priority: asOptionalString(workOrder?.priority, 40) || "normal",
    status: normalizeStatus(workOrder?.status),
    dueDate: toMillis(workOrder?.dueDate || workOrder?.scheduledFor || workOrder?.serviceWindowStartAt),
    scheduledFor: toMillis(workOrder?.scheduledFor),
    property: {
      label: propertyLabel(workOrder),
      slug: asOptionalString(workOrder?.propertySlug, 160),
    },
    unit: {
      label: unitLabel(workOrder),
    },
    landlord: {
      name:
        asOptionalString(workOrder?.landlordContact?.name, 180) ||
        asOptionalString(workOrder?.landlordName, 180) ||
        "Landlord",
      email:
        asOptionalString(workOrder?.landlordContact?.email, 320) ||
        asOptionalString(workOrder?.landlordEmail, 320),
    },
    assignment: {
      contractorName:
        asOptionalString(assignment?.displayName, 180) ||
        asOptionalString(workOrder?.assignedContractorName, 180),
      assignedAt: asOptionalString(assignment?.assignedAt, 80) || toMillis(workOrder?.assignedAt),
    },
    statusHistory: (extras?.updates || []).map((update) => ({
      id: asString(update?.id, 160),
      type: asOptionalString(update?.updateType, 80) || "status_changed",
      message: asOptionalString(update?.message, 1000),
      actorRole: asOptionalString(update?.actorRole, 40),
      createdAt: toMillis(update?.createdAtMs || update?.createdAt),
    })),
    messages: (extras?.messages || []).map((message) => projectContractorMessage(message, workOrderId)),
  };
}

async function findAssignedWorkOrder(contractorId: string, workOrderId: string) {
  const snap = await db.collection("workOrders").doc(workOrderId).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  if (asString(data?.assignedContractorId, 160) !== contractorId) return null;
  return { id: snap.id, data };
}

async function listUpdates(workOrderId: string) {
  const snap = await db.collection("workOrderUpdates").where("workOrderId", "==", workOrderId).limit(100).get();
  return snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
}

async function listMessagesForWorkOrder(contractorId: string, workOrderId: string) {
  const snap = await db
    .collection("contractorMessages")
    .where("contractorId", "==", contractorId)
    .where("workOrderId", "==", workOrderId)
    .limit(100)
    .get();
  return snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));
}

export async function listContractorPortalWorkOrders(contractorId: string, status?: string | null) {
  const snap = await db.collection("workOrders").where("assignedContractorId", "==", contractorId).limit(300).get();
  const wantedStatus = status ? normalizeStatus(status) : null;
  return snap.docs
    .map((doc: any) => projectWorkOrder(doc.id, doc.data() as any))
    .filter((item) => !wantedStatus || item.status === wantedStatus)
    .sort((a, b) => Number(b.dueDate || 0) - Number(a.dueDate || 0));
}

export async function getContractorPortalWorkOrder(contractorId: string, workOrderId: string) {
  const found = await findAssignedWorkOrder(contractorId, workOrderId);
  if (!found) return null;
  const [updates, messages] = await Promise.all([
    listUpdates(found.id),
    listMessagesForWorkOrder(contractorId, found.id),
  ]);
  return projectWorkOrder(found.id, found.data, { updates, messages });
}

export async function updateContractorPortalWorkOrderStatus(input: {
  contractorId: string;
  actorId: string;
  workOrderId: string;
  status: string;
  message?: string | null;
}) {
  const found = await findAssignedWorkOrder(input.contractorId, input.workOrderId);
  if (!found) return { ok: false as const, code: "not_found" as const };
  const currentStatus = normalizeStatus(found.data?.status);
  const nextStatus = normalizeStatus(input.status);
  if (currentStatus !== nextStatus && !TRANSITIONS[currentStatus].includes(nextStatus)) {
    return { ok: false as const, code: "invalid_transition" as const, currentStatus, nextStatus };
  }

  const now = Date.now();
  const message =
    asOptionalString(input.message, 1000) || `Contractor updated work order status to ${nextStatus}.`;
  await db.collection("workOrders").doc(found.id).set(
    {
      status: nextStatus,
      contractorStatus: nextStatus,
      contractorLastUpdate: message,
      lastExecutionUpdateAt: now,
      updatedAtMs: now,
    },
    { merge: true }
  );
  await db.collection("workOrderUpdates").doc().set({
    workOrderId: found.id,
    actorRole: "contractor",
    actorId: input.actorId || input.contractorId,
    updateType: "status_changed",
    message,
    attachmentUrl: null,
    createdAtMs: now,
    rawIdsIncluded: false,
    payloadIncluded: false,
  });
  return { ok: true as const, item: await getContractorPortalWorkOrder(input.contractorId, found.id) };
}

export async function listContractorPortalMessages(contractorId: string, workOrderId?: string | null) {
  let query: any = db.collection("contractorMessages").where("contractorId", "==", contractorId);
  if (workOrderId) query = query.where("workOrderId", "==", workOrderId);
  const snap = await query.limit(200).get();
  return snap.docs
    .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a: any, b: any) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
    .map((message: any) => projectContractorMessage(message));
}

export async function createContractorPortalMessage(input: {
  contractorId: string;
  actorId: string;
  workOrderId: string;
  landlordId: string;
  text: string;
}) {
  const found = await findAssignedWorkOrder(input.contractorId, input.workOrderId);
  if (!found) return { ok: false as const, code: "not_found" as const };
  const landlordId = asString(found.data?.landlordId, 160);
  if (!landlordId || landlordId !== asString(input.landlordId, 160)) {
    return { ok: false as const, code: "forbidden" as const };
  }
  const text = asString(input.text, 2000);
  if (!text) return { ok: false as const, code: "invalid_message" as const };
  const now = Date.now();
  const ref = db.collection("contractorMessages").doc();
  const message = {
    id: ref.id,
    contractorId: input.contractorId,
    landlordId,
    workOrderId: found.id,
    senderRole: "contractor",
    senderId: input.actorId || input.contractorId,
    senderName: asOptionalString(found.data?.contractorAssignment?.displayName, 180) || "Contractor",
    recipientRole: "landlord",
    text,
    createdAtMs: now,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  await ref.set(message);
  await db.collection("workOrderUpdates").doc().set({
    workOrderId: found.id,
    actorRole: "contractor",
    actorId: input.actorId || input.contractorId,
    updateType: "note",
    message: "Contractor sent a message.",
    attachmentUrl: null,
    createdAtMs: now,
    rawIdsIncluded: false,
    payloadIncluded: false,
  });
  return { ok: true as const, message: projectContractorMessage(message) };
}

export async function getContractorPortalProfile(contractorId: string) {
  const snap = await db.collection("contractorProfiles").doc(contractorId).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return {
    id: snap.id,
    name: asOptionalString(data?.name || data?.displayName || data?.contactName, 180),
    businessName: asOptionalString(data?.businessName || data?.displayName, 180),
    email: asOptionalString(data?.email || data?.contact?.email, 320),
    phone: asOptionalString(data?.phone || data?.contact?.phone, 80),
    specialties: uniqueStrings(data?.specialties || data?.serviceCategories, 30),
    serviceAreas: uniqueStrings(data?.serviceAreas, 30),
    availability: asOptionalString(data?.availability || data?.availabilityStatus, 40) || "active",
    bio: asOptionalString(data?.bio || data?.summary, 2000),
  };
}

export async function updateContractorPortalProfile(contractorId: string, input: any) {
  const now = Date.now();
  const patch: Record<string, unknown> = { updatedAtMs: now };
  if (input?.name !== undefined) {
    patch.name = asString(input.name, 180);
    patch.contactName = asString(input.name, 180);
  }
  if (input?.businessName !== undefined) patch.businessName = asString(input.businessName, 180);
  if (input?.phone !== undefined) patch.phone = asString(input.phone, 80);
  if (input?.specialties !== undefined) {
    patch.specialties = uniqueStrings(input.specialties, 30);
    patch.serviceCategories = uniqueStrings(input.specialties, 30);
  }
  if (input?.serviceAreas !== undefined) patch.serviceAreas = uniqueStrings(input.serviceAreas, 30);
  if (input?.availability !== undefined) {
    patch.availability = asString(input.availability, 40);
    patch.availabilityStatus = asString(input.availability, 40);
  }
  if (input?.bio !== undefined) patch.bio = asString(input.bio, 2000);
  await db.collection("contractorProfiles").doc(contractorId).set(patch, { merge: true });
  return getContractorPortalProfile(contractorId);
}
