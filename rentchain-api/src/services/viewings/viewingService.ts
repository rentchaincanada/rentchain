import {
  createViewingRequestDoc,
  getViewingRequestDoc,
  listViewingRequestDocsByLandlord,
  newViewingRequestId,
  resolveViewingOwnershipContext,
  saveViewingRequestDoc,
} from "./viewingRepository";
import type {
  CancelViewingRequestInput,
  CreateViewingRequestInput,
  ProposeViewingSlotsInput,
  SelectViewingSlotInput,
  SelectedViewingSlot,
  ViewingRequestDoc,
  ViewingSlot,
} from "./viewingTypes";

type ViewingErrorCode =
  | "validation_failed"
  | "viewing_not_found"
  | "forbidden"
  | "invalid_status_transition"
  | "invalid_slot_selection";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ViewingServiceError extends Error {
  statusCode: number;
  code: ViewingErrorCode;

  constructor(statusCode: number, code: ViewingErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function optionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized || null;
}

function requireString(value: unknown, fieldName: string) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new ViewingServiceError(400, "validation_failed", `${fieldName} is required.`);
  }
  return normalized;
}

function requireViewingFound(doc: ViewingRequestDoc | null): ViewingRequestDoc {
  if (!doc) {
    throw new ViewingServiceError(404, "viewing_not_found", "Viewing request not found.");
  }
  return doc;
}

function assertOwnedByLandlord(doc: ViewingRequestDoc, landlordId: string) {
  if (String(doc.landlordId || "").trim() !== String(landlordId || "").trim()) {
    throw new ViewingServiceError(403, "forbidden", "You do not have access to this viewing request.");
  }
}

function validateDateString(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ViewingServiceError(400, "validation_failed", `${fieldName} must be a valid datetime.`);
  }
  return parsed;
}

function normalizeSlot(input: ViewingSlot, index: number): ViewingSlot {
  const id = requireString(input?.id, `proposedSlots[${index}].id`);
  const startAt = requireString(input?.startAt, `proposedSlots[${index}].startAt`);
  const endAt = requireString(input?.endAt, `proposedSlots[${index}].endAt`);
  const start = validateDateString(startAt, `proposedSlots[${index}].startAt`);
  const end = validateDateString(endAt, `proposedSlots[${index}].endAt`);
  if (end.getTime() <= start.getTime()) {
    throw new ViewingServiceError(
      400,
      "validation_failed",
      `proposedSlots[${index}] must end after it starts.`
    );
  }
  return {
    id,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    note: optionalString(input?.note),
    isSelected: false,
  };
}

function validateSlots(input: ProposeViewingSlotsInput): ViewingSlot[] {
  const proposedSlots = Array.isArray(input?.proposedSlots) ? input.proposedSlots : [];
  if (!proposedSlots.length) {
    throw new ViewingServiceError(400, "validation_failed", "At least one proposed slot is required.");
  }
  if (proposedSlots.length > 10) {
    throw new ViewingServiceError(400, "validation_failed", "You can propose up to 10 slots.");
  }
  return proposedSlots.map((slot, index) => normalizeSlot(slot, index));
}

function buildSelectedSlot(slot: ViewingSlot): SelectedViewingSlot {
  return {
    id: slot.id,
    startAt: slot.startAt,
    endAt: slot.endAt,
    note: slot.note || null,
  };
}

export async function createViewingRequest(input: CreateViewingRequestInput): Promise<ViewingRequestDoc> {
  const propertyId = optionalString(input.propertyId);
  const unitId = optionalString(input.unitId);
  if (!propertyId && !unitId) {
    throw new ViewingServiceError(
      400,
      "validation_failed",
      "propertyId or unitId is required to request a viewing."
    );
  }

  const applicantName = requireString(input.applicantName, "applicantName");
  const applicantEmail = requireString(input.applicantEmail, "applicantEmail").toLowerCase();
  if (!EMAIL_REGEX.test(applicantEmail)) {
    throw new ViewingServiceError(400, "validation_failed", "applicantEmail must be valid.");
  }

  const ownership = await resolveViewingOwnershipContext({ propertyId, unitId });
  if (!ownership.landlordId) {
    throw new ViewingServiceError(
      400,
      "validation_failed",
      "Unable to resolve landlord ownership for this viewing request."
    );
  }

  const now = nowIso();
  const viewingRequest: ViewingRequestDoc = {
    id: newViewingRequestId(),
    landlordId: ownership.landlordId,
    propertyId: ownership.propertyId,
    unitId: ownership.unitId,
    applicationId: optionalString(input.applicationId),
    applicantName,
    applicantEmail,
    applicantPhone: optionalString(input.applicantPhone),
    requestedMessage: optionalString(input.requestedMessage),
    status: "requested",
    proposedSlots: [],
    selectedSlotId: null,
    selectedSlot: null,
    requestedAt: now,
    slotsProposedAt: null,
    scheduledAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledReason: null,
    createdAt: now,
    updatedAt: now,
    updatedByUserId: null,
  };

  return createViewingRequestDoc(viewingRequest);
}

export async function listViewingRequestsForLandlord(
  landlordId: string
): Promise<ViewingRequestDoc[]> {
  const docs = await listViewingRequestDocsByLandlord(landlordId);
  return docs.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getViewingRequestForLandlord(
  viewingRequestId: string,
  landlordId: string
): Promise<ViewingRequestDoc> {
  const doc = requireViewingFound(await getViewingRequestDoc(viewingRequestId));
  assertOwnedByLandlord(doc, landlordId);
  return doc;
}

export async function proposeViewingSlots(
  viewingRequestId: string,
  landlordId: string,
  userId: string,
  input: ProposeViewingSlotsInput
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (existing.status !== "requested" && existing.status !== "slots_proposed") {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "Slots can only be proposed for requested viewings."
    );
  }

  const now = nowIso();
  const proposedSlots = validateSlots(input);
  const next: ViewingRequestDoc = {
    ...existing,
    status: "slots_proposed",
    proposedSlots,
    selectedSlotId: null,
    selectedSlot: null,
    slotsProposedAt: now,
    updatedAt: now,
    updatedByUserId: userId,
  };
  return saveViewingRequestDoc(next);
}

export async function selectViewingSlot(
  viewingRequestId: string,
  landlordId: string,
  userId: string,
  input: SelectViewingSlotInput
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (existing.status === "completed" || existing.status === "cancelled") {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "A completed or cancelled viewing cannot be scheduled."
    );
  }
  if (existing.status !== "slots_proposed") {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "A slot can only be selected after times are proposed."
    );
  }

  const slotId = requireString(input.slotId, "slotId");
  const selected = existing.proposedSlots.find((slot) => slot.id === slotId);
  if (!selected) {
    throw new ViewingServiceError(
      400,
      "invalid_slot_selection",
      "The selected slot does not exist on this viewing request."
    );
  }

  const now = nowIso();
  const next: ViewingRequestDoc = {
    ...existing,
    status: "scheduled",
    proposedSlots: existing.proposedSlots.map((slot) => ({
      ...slot,
      isSelected: slot.id === slotId,
    })),
    selectedSlotId: slotId,
    selectedSlot: buildSelectedSlot(selected),
    scheduledAt: now,
    updatedAt: now,
    updatedByUserId: userId,
  };
  return saveViewingRequestDoc(next);
}

export async function completeViewingRequest(
  viewingRequestId: string,
  landlordId: string,
  userId: string
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (existing.status !== "scheduled") {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "Only scheduled viewings can be completed."
    );
  }
  const now = nowIso();
  return saveViewingRequestDoc({
    ...existing,
    status: "completed",
    completedAt: now,
    updatedAt: now,
    updatedByUserId: userId,
  });
}

export async function cancelViewingRequest(
  viewingRequestId: string,
  landlordId: string,
  userId: string,
  input: CancelViewingRequestInput
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (!["requested", "slots_proposed", "scheduled"].includes(existing.status)) {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "This viewing request cannot be cancelled."
    );
  }
  const now = nowIso();
  return saveViewingRequestDoc({
    ...existing,
    status: "cancelled",
    cancelledAt: now,
    cancelledReason: optionalString(input.cancelledReason),
    updatedAt: now,
    updatedByUserId: userId,
  });
}
