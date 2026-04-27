import { writeCanonicalEvent } from "../../lib/events/buildEvent";

export const TRANSUNION_USAGE_EVENT_TYPES = [
  "tu_option_viewed",
  "tu_get_access_clicked",
  "tu_have_credentials_clicked",
  "tu_onboarding_viewed",
  "tu_onboarding_started",
  "tu_email_clicked",
  "tu_phone_clicked",
  "tu_already_credentialed_clicked",
  "tu_credentials_connected",
  "tu_credentials_submitted",
  "tu_connected",
  "tu_connection_failed",
  "screening_request_created",
  "screening_consent_confirmed",
  "screening_permissible_purpose_confirmed",
  "screening_request_submitted",
  "screening_completed",
  "screening_blocked",
] as const;

export type TransUnionUsageEventType = (typeof TRANSUNION_USAGE_EVENT_TYPES)[number];

type TransUnionUsageEventInput = {
  eventType: TransUnionUsageEventType;
  landlordId?: string | null;
  userId?: string | null;
  actorRole?: string | null;
  actorType?: "user" | "admin" | "landlord" | "service" | "system";
  propertyId?: string | null;
  applicationId?: string | null;
  screeningRequestId?: string | null;
  orderId?: string | null;
  sourceSurface?: string | null;
  reason?: string | null;
  blockReason?: string | null;
  status?: string | null;
  occurredAt?: string | number | Date | null;
  metadata?: Record<string, unknown>;
};

const EVENT_SUMMARIES: Record<TransUnionUsageEventType, string> = {
  tu_option_viewed: "TransUnion option viewed",
  tu_get_access_clicked: "TransUnion get access clicked",
  tu_have_credentials_clicked: "TransUnion existing credentials clicked",
  tu_onboarding_viewed: "TransUnion onboarding viewed",
  tu_onboarding_started: "TransUnion onboarding started",
  tu_email_clicked: "TransUnion onboarding email clicked",
  tu_phone_clicked: "TransUnion onboarding phone clicked",
  tu_already_credentialed_clicked: "TransUnion already credentialed clicked",
  tu_credentials_connected: "TransUnion credentials connected",
  tu_credentials_submitted: "TransUnion credentials submitted",
  tu_connected: "TransUnion connected",
  tu_connection_failed: "TransUnion connection failed",
  screening_request_created: "Screening request created",
  screening_consent_confirmed: "Screening consent confirmed",
  screening_permissible_purpose_confirmed: "Screening permissible purpose confirmed",
  screening_request_submitted: "Screening request submitted",
  screening_completed: "Screening completed",
  screening_blocked: "Screening blocked",
};

function cleanString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function pickActorType(
  actorType: TransUnionUsageEventInput["actorType"],
  actorRole: string | null
): "user" | "admin" | "landlord" | "service" | "system" {
  if (actorType) return actorType;
  if (actorRole === "admin") return "admin";
  if (actorRole === "landlord") return "landlord";
  if (actorRole === "system") return "system";
  if (actorRole === "service") return "service";
  return "user";
}

export async function writeTransUnionUsageEvent(
  input: TransUnionUsageEventInput
): Promise<void> {
  const landlordId = cleanString(input.landlordId);
  const userId = cleanString(input.userId);
  const applicationId = cleanString(input.applicationId);
  const propertyId = cleanString(input.propertyId);
  const orderId = cleanString(input.orderId || input.screeningRequestId);
  const actorRole = cleanString(input.actorRole);

  const resource = orderId
    ? {
        type: "screening_order",
        id: orderId,
        parentType: applicationId ? "rental_application" : landlordId ? "landlord" : "screening_provider",
        parentId: applicationId || landlordId || "transunion",
      }
    : applicationId
      ? {
          type: "rental_application",
          id: applicationId,
          parentType: landlordId ? "landlord" : "screening_provider",
          parentId: landlordId || "transunion",
        }
      : {
          type: "screening_provider",
          id: "transunion",
          parentType: landlordId ? "landlord" : null,
          parentId: landlordId,
        };

  const metadata = {
    providerKey: "transunion",
    landlordId,
    userId,
    propertyId,
    applicationId,
    screeningRequestId: orderId,
    orderId,
    sourceSurface: cleanString(input.sourceSurface),
    reason: cleanString(input.reason),
    blockReason: cleanString(input.blockReason),
    ...input.metadata,
  };

  await writeCanonicalEvent({
    type: input.eventType,
    domain: "screening",
    action: input.eventType,
    status: cleanString(input.status),
    actor: {
      type: pickActorType(input.actorType, actorRole),
      id: userId || landlordId,
      role: actorRole,
    },
    resource,
    occurredAt: input.occurredAt || Date.now(),
    visibility: "internal",
    summary: EVENT_SUMMARIES[input.eventType],
    metadata,
    tags: ["provider:transunion", "usage-reporting"],
  });
}
