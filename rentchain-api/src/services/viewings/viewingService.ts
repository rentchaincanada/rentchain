import { createHash } from "crypto";
import { db } from "../../firebase";
import { buildEmailHtml, buildEmailText } from "../../email/templates/baseEmailTemplate";
import { sendEmail } from "../emailService";
import {
  createViewingRequestDoc,
  getViewingRequestDoc,
  listViewingRequestDocsByLandlord,
  newViewingRequestId,
  resolveViewingOwnershipContext,
  saveViewingRequestDoc,
  saveViewingRequestWithNotification,
} from "./viewingRepository";
import type {
  CancelViewingRequestInput,
  CreateViewingRequestInput,
  ProposeViewingSlotsInput,
  RescheduleViewingRequestInput,
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

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => EMAIL_REGEX.test(value))
    )
  );
}

async function resolveViewingRecipients(params: {
  landlordId: string;
  propertyId: string | null;
}) {
  const recipients = new Set<string>();
  let propertyLabel: string | null = null;
  const propertyId = optionalString(params.propertyId);

  if (propertyId) {
    try {
      const propertySnap = await db.collection("properties").doc(propertyId).get();
      if (propertySnap.exists) {
        const property = (propertySnap.data() as any) || {};
        propertyLabel = optionalString(property?.name) || optionalString(property?.addressLine1);
        const managerEmail = optionalString(property?.managerEmail);
        if (managerEmail && EMAIL_REGEX.test(managerEmail)) recipients.add(managerEmail.toLowerCase());
        const managerIds = Array.isArray(property?.managerUserIds)
          ? property.managerUserIds.map((value: any) => String(value || "").trim()).filter(Boolean)
          : [];
        await Promise.all(
          managerIds.map(async (managerId: string) => {
            try {
              const userSnap = await db.collection("users").doc(managerId).get();
              if (!userSnap.exists) return;
              const email = optionalString((userSnap.data() as any)?.email);
              if (email && EMAIL_REGEX.test(email)) recipients.add(email.toLowerCase());
            } catch {
              // ignore recipient lookup failure
            }
          })
        );
      }
    } catch {
      // ignore property lookup failure
    }
  }

  try {
    const userSnap = await db.collection("users").doc(params.landlordId).get();
    if (userSnap.exists) {
      const email = optionalString((userSnap.data() as any)?.email);
      if (email && EMAIL_REGEX.test(email)) recipients.add(email.toLowerCase());
    }
  } catch {
    // ignore recipient lookup failure
  }

  if (recipients.size === 0) {
    try {
      const landlordSnap = await db.collection("landlords").doc(params.landlordId).get();
      if (landlordSnap.exists) {
        const email = optionalString((landlordSnap.data() as any)?.email);
        if (email && EMAIL_REGEX.test(email)) recipients.add(email.toLowerCase());
      }
    } catch {
      // ignore recipient lookup failure
    }
  }

  return {
    propertyLabel,
    recipients: Array.from(recipients),
  };
}

async function notifyViewingRequestCreated(viewingRequest: ViewingRequestDoc) {
  const { recipients, propertyLabel } = await resolveViewingRecipients({
    landlordId: viewingRequest.landlordId,
    propertyId: viewingRequest.propertyId,
  });
  if (!recipients.length) return;

  const from =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    process.env.FROM_EMAIL;
  if (!from) return;

  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const unitLabel = optionalString(viewingRequest.unitId) ? `Unit ${viewingRequest.unitId}` : null;
  const propertySummary = [propertyLabel || optionalString(viewingRequest.propertyId), unitLabel].filter(Boolean).join(" • ");
  const requestLink = `${baseUrl}/viewings`;
  const introLines = [
    `${viewingRequest.applicantName} (${viewingRequest.applicantEmail}) requested a viewing${propertySummary ? ` for ${propertySummary}` : ""}.`,
  ];
  if (viewingRequest.requestedMessage) {
    introLines.push(`Message: ${viewingRequest.requestedMessage}`);
  }

  await sendEmail({
    to: uniqueEmails(recipients),
    from,
    replyTo: from,
    subject: `New viewing request${propertySummary ? ` for ${propertySummary}` : ""}`,
    text: buildEmailText({
      intro: introLines.join("\n\n"),
      ctaText: "Open viewings",
      ctaUrl: requestLink,
    }),
    html: buildEmailHtml({
      title: "New viewing request",
      intro: introLines.join(" "),
      ctaText: "Open viewings",
      ctaUrl: requestLink,
    }),
  });
}

async function resolveViewingLocationSummary(viewingRequest: ViewingRequestDoc): Promise<string> {
  let propertyLabel: string | null = null;
  let unitLabel: string | null = null;
  const propertyId = optionalString(viewingRequest.propertyId);
  const unitId = optionalString(viewingRequest.unitId);

  if (propertyId) {
    try {
      const propertySnap = await db.collection("properties").doc(propertyId).get();
      if (propertySnap.exists) {
        const property = (propertySnap.data() as any) || {};
        propertyLabel =
          optionalString(property?.name) ||
          optionalString(property?.addressLine1) ||
          optionalString(property?.address) ||
          optionalString(property?.displayName);
      }
    } catch {
      // ignore property label lookup failure
    }
  }

  if (unitId) {
    try {
      const unitSnap = await db.collection("units").doc(unitId).get();
      if (unitSnap.exists) {
        const unit = (unitSnap.data() as any) || {};
        const unitNumber =
          optionalString(unit?.unitNumber) ||
          optionalString(unit?.number) ||
          optionalString(unit?.name) ||
          optionalString(unit?.displayName);
        unitLabel = unitNumber ? `Unit ${unitNumber}` : null;
      }
    } catch {
      // ignore unit label lookup failure
    }
  }

  return [propertyLabel, unitLabel].filter(Boolean).join(" • ") || "the requested property";
}

function formatViewingSlotRange(slot: NonNullable<SelectedViewingSlot>): string {
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "the selected viewing time";
  }

  const startDate = start.toISOString().slice(0, 10);
  const startTime = start.toISOString().slice(11, 16);
  const endDate = end.toISOString().slice(0, 10);
  const endTime = end.toISOString().slice(11, 16);
  if (startDate === endDate) {
    return `${startDate} from ${startTime} to ${endTime} UTC`;
  }
  return `${startDate} ${startTime} UTC to ${endDate} ${endTime} UTC`;
}

async function notifyViewingSlotSelected(viewingRequest: ViewingRequestDoc) {
  const applicantEmail = optionalString(viewingRequest.applicantEmail)?.toLowerCase();
  if (!applicantEmail || !EMAIL_REGEX.test(applicantEmail)) return;

  const selectedSlot = viewingRequest.selectedSlot;
  if (!selectedSlot) return;

  const from =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM ||
    process.env.FROM_EMAIL;
  if (!from) return;

  const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const locationSummary = await resolveViewingLocationSummary(viewingRequest);
  const slotRange = formatViewingSlotRange(selectedSlot);
  const requestLink = `${baseUrl}/viewings`;
  const bullets = [`When: ${slotRange}`, `Location: ${locationSummary}`];
  if (selectedSlot.note) {
    bullets.push(`Note: ${selectedSlot.note}`);
  }

  await sendEmail({
    to: applicantEmail,
    from,
    replyTo: from,
    subject: `Viewing confirmed for ${locationSummary}`,
    text: buildEmailText({
      intro: "Your viewing time has been confirmed.",
      bullets,
      ctaText: "Open viewings",
      ctaUrl: requestLink,
      footerNote: "You're receiving this because you requested a viewing through RentChain.",
    }),
    html: buildEmailHtml({
      title: "Viewing time confirmed",
      intro: "Your viewing time has been confirmed.",
      bullets,
      ctaText: "Open viewings",
      ctaUrl: requestLink,
      footerNote: "You're receiving this because you requested a viewing through RentChain.",
      preheader: `Viewing confirmed for ${slotRange}.`,
    }),
  });
}

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

function safeHash(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 24);
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

function safeViewingRef(viewingRequestId: string): string {
  return `viewing_v1_${safeHash(`viewing:${viewingRequestId}`)}`;
}

function notificationIdForViewing(params: {
  type: "viewing-cancelled" | "viewing-rescheduled";
  viewingRequestId: string;
  transitionKey: string;
}) {
  return `viewing_notification_v1_${safeHash(`${params.type}:${params.viewingRequestId}:${params.transitionKey}`)}`;
}

function auditEventIdForViewing(params: {
  type: "viewing_cancelled" | "viewing_rescheduled";
  viewingRequestId: string;
  transitionKey: string;
}) {
  return `viewing_event_v1_${safeHash(`${params.type}:${params.viewingRequestId}:${params.transitionKey}`)}`;
}

function tenantScopeKeyForViewing(viewingRequest: ViewingRequestDoc): string {
  const directTenantId = optionalString((viewingRequest as any)?.tenantId || (viewingRequest as any)?.applicantTenantId);
  if (directTenantId) return directTenantId;
  return `applicant_email_v1_${safeHash(String(viewingRequest.applicantEmail || "").toLowerCase())}`;
}

function buildViewingTenantNotification(params: {
  type: "viewing-cancelled" | "viewing-rescheduled";
  viewingRequest: ViewingRequestDoc;
  title: string;
  summary: string;
  transitionKey: string;
  status: "info" | "warning";
  occurredAt: string;
  payload: Record<string, unknown>;
}) {
  const tenantId = tenantScopeKeyForViewing(params.viewingRequest);
  const viewingReference = safeViewingRef(params.viewingRequest.id);
  return {
    id: notificationIdForViewing({
      type: params.type,
      viewingRequestId: params.viewingRequest.id,
      transitionKey: params.transitionKey,
    }),
    tenantId,
    tenantWorkspaceId: tenantId,
    applicantEmail: optionalString(params.viewingRequest.applicantEmail),
    recipientRole: "applicant",
    type: "viewing",
    notificationType: params.type,
    sourceKind: "tenant.viewing",
    sourceType: "viewing",
    title: params.title,
    summary: params.summary,
    body: params.summary,
    status: params.status,
    priority: params.status === "warning" ? "high" : "normal",
    relatedPath: "/viewings",
    createdAt: params.occurredAt,
    updatedAt: params.occurredAt,
    readAt: null,
    read: false,
    viewingRequestId: viewingReference,
    payload: {
      ...params.payload,
      viewingRequestId: viewingReference,
      landlordName: "Landlord",
    },
    sourceRefs: [
      {
        sourceType: "viewing",
        referenceKey: `viewing:${viewingReference}`,
        label: "Viewing request",
      },
    ],
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function buildViewingAuditEvent(params: {
  type: "viewing_cancelled" | "viewing_rescheduled";
  viewingRequest: ViewingRequestDoc;
  actorUserId: string;
  transitionKey: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}) {
  return {
    id: auditEventIdForViewing({
      type: params.type,
      viewingRequestId: params.viewingRequest.id,
      transitionKey: params.transitionKey,
    }),
    viewingRequestRef: safeViewingRef(params.viewingRequest.id),
    landlordId: params.viewingRequest.landlordId,
    actorRole: "landlord",
    actorUserId: params.actorUserId,
    eventType: params.type,
    createdAt: params.occurredAt,
    metadata: params.metadata,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
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

  const saved = await createViewingRequestDoc(viewingRequest);
  try {
    await notifyViewingRequestCreated(saved);
  } catch (error: any) {
    console.error("[viewings] viewing request email failed", {
      viewingRequestId: saved.id,
      landlordId: saved.landlordId,
      message: error?.message || "send_failed",
    });
  }
  return saved;
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
  const saved = await saveViewingRequestDoc(next);
  try {
    await notifyViewingSlotSelected(saved);
  } catch (error: any) {
    console.error("[viewings] viewing slot confirmation email failed", {
      message: error?.message || "send_failed",
    });
  }
  return saved;
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
  if (existing.status === "cancelled") return notifyViewingCancelled(existing.id, landlordId, userId, input);
  if (!["requested", "slots_proposed", "scheduled"].includes(existing.status)) {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "This viewing request cannot be cancelled."
    );
  }
  return notifyViewingCancelled(existing.id, landlordId, userId, input);
}

export async function notifyViewingCancelled(
  viewingRequestId: string,
  landlordId: string,
  userIdOrReason?: string | null,
  inputOrReason?: CancelViewingRequestInput | string | null
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  const userId =
    typeof inputOrReason === "object" && inputOrReason !== null
      ? optionalString(userIdOrReason) || landlordId
      : landlordId;
  const cancellationReason =
    typeof inputOrReason === "object" && inputOrReason !== null
      ? optionalString(inputOrReason.cancelledReason)
      : optionalString(inputOrReason || userIdOrReason);
  const now = existing.status === "cancelled" && existing.cancelledAt ? existing.cancelledAt : nowIso();
  const next: ViewingRequestDoc = {
    ...existing,
    status: "cancelled",
    cancelledAt: now,
    cancelledReason: cancellationReason || existing.cancelledReason || null,
    updatedAt: now,
    updatedByUserId: userId,
  };
  const locationSummary = await resolveViewingLocationSummary(existing);
  const transitionKey = "cancelled";
  const notification = buildViewingTenantNotification({
    type: "viewing-cancelled",
    viewingRequest: next,
    title: "Viewing cancelled",
    summary: `Your viewing for ${locationSummary} has been cancelled.`,
    transitionKey,
    status: "warning",
    occurredAt: now,
    payload: {
      cancellationReason: next.cancelledReason,
    },
  });
  const auditEvent = buildViewingAuditEvent({
    type: "viewing_cancelled",
    viewingRequest: next,
    actorUserId: userId,
    transitionKey,
    occurredAt: now,
    metadata: {
      status: "cancelled",
      cancellationReasonProvided: Boolean(next.cancelledReason),
    },
  });
  return saveViewingRequestWithNotification({ viewingRequest: next, notification, auditEvent });
}

export async function rescheduleViewingRequest(
  viewingRequestId: string,
  landlordId: string,
  userId: string,
  input: RescheduleViewingRequestInput
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (existing.status !== "scheduled" || !existing.selectedSlot) {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "Only scheduled viewings can be rescheduled."
    );
  }
  const newScheduledTime = requireString(input.newScheduledTime, "newScheduledTime");
  const newStart = validateDateString(newScheduledTime, "newScheduledTime");
  if (existing.selectedSlot.startAt === newStart.toISOString()) return existing;
  return notifyViewingRescheduled(
    existing.id,
    landlordId,
    userId,
    existing.selectedSlot.startAt,
    newStart.toISOString()
  );
}

export async function notifyViewingRescheduled(
  viewingRequestId: string,
  landlordId: string,
  userIdOrOldTime: string | Date,
  oldTimeOrNewTime: string | Date,
  maybeNewTime?: string | Date
): Promise<ViewingRequestDoc> {
  const existing = await getViewingRequestForLandlord(viewingRequestId, landlordId);
  if (!existing.selectedSlot) {
    throw new ViewingServiceError(
      409,
      "invalid_status_transition",
      "A selected viewing time is required before rescheduling."
    );
  }

  const userId = maybeNewTime == null ? landlordId : normalizeString(userIdOrOldTime);
  const oldTimeInput = maybeNewTime == null ? userIdOrOldTime : oldTimeOrNewTime;
  const newTimeInput = maybeNewTime == null ? oldTimeOrNewTime : maybeNewTime;
  const oldStart = validateDateString(
    oldTimeInput instanceof Date ? oldTimeInput.toISOString() : normalizeString(oldTimeInput),
    "oldTime"
  );
  const newStart = validateDateString(
    newTimeInput instanceof Date ? newTimeInput.toISOString() : normalizeString(newTimeInput),
    "newScheduledTime"
  );
  if (oldStart.toISOString() === newStart.toISOString()) return existing;
  const existingStart = validateDateString(existing.selectedSlot.startAt, "selectedSlot.startAt");
  const existingEnd = validateDateString(existing.selectedSlot.endAt, "selectedSlot.endAt");
  const durationMs = Math.max(15 * 60 * 1000, existingEnd.getTime() - existingStart.getTime());
  const newEnd = new Date(newStart.getTime() + durationMs);
  const now = nowIso();
  const next: ViewingRequestDoc = {
    ...existing,
    status: "scheduled",
    selectedSlot: {
      ...existing.selectedSlot,
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
    },
    proposedSlots: existing.proposedSlots.map((slot) =>
      slot.id === existing.selectedSlot?.id
        ? { ...slot, startAt: newStart.toISOString(), endAt: newEnd.toISOString(), isSelected: true }
        : slot
    ),
    scheduledAt: now,
    updatedAt: now,
    updatedByUserId: userId || landlordId,
  };
  const locationSummary = await resolveViewingLocationSummary(existing);
  const transitionKey = `${oldStart.toISOString()}-${newStart.toISOString()}`;
  const notification = buildViewingTenantNotification({
    type: "viewing-rescheduled",
    viewingRequest: next,
    title: "Viewing rescheduled",
    summary: `Your viewing for ${locationSummary} has been rescheduled.`,
    transitionKey,
    status: "info",
    occurredAt: now,
    payload: {
      oldTime: oldStart.toISOString(),
      newTime: newStart.toISOString(),
    },
  });
  const auditEvent = buildViewingAuditEvent({
    type: "viewing_rescheduled",
    viewingRequest: next,
    actorUserId: userId || landlordId,
    transitionKey,
    occurredAt: now,
    metadata: {
      oldTime: oldStart.toISOString(),
      newTime: newStart.toISOString(),
    },
  });
  return saveViewingRequestWithNotification({ viewingRequest: next, notification, auditEvent });
}
