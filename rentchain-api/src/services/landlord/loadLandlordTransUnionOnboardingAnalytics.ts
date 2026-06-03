import { db } from "../../firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";

export type LandlordTransUnionOnboardingAnalytics = {
  totals: {
    viewed: number;
    started: number;
    emailClicked: number;
    phoneClicked: number;
    alreadyCredentialedClicked: number;
    connected: number;
  };
  conversionRate: number | null;
};

const ONBOARDING_EVENT_TYPES = new Set([
  "tu_onboarding_viewed",
  "tu_onboarding_started",
  "tu_email_clicked",
  "tu_phone_clicked",
  "tu_already_credentialed_clicked",
  "tu_credentials_connected",
]);

function cleanString(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function landlordIdForEvent(event: CanonicalEventV1): string | null {
  const metadata = (event.metadata || {}) as Record<string, unknown>;
  return (
    cleanString(metadata.landlordId) ||
    cleanString((event as any).landlordId) ||
    cleanString(event.actor?.id) ||
    cleanString(event.resource?.parentId)
  );
}

function isTransUnionOnboardingEvent(event: CanonicalEventV1) {
  const type = cleanString(event.type);
  const providerKey = cleanString((event.metadata || {})?.providerKey)?.toLowerCase();
  return Boolean(type && ONBOARDING_EVENT_TYPES.has(type) && providerKey === "transunion");
}

function roundRatio(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function deriveLandlordTransUnionOnboardingAnalytics(
  events: CanonicalEventV1[],
  landlordId: string
): LandlordTransUnionOnboardingAnalytics {
  const scoped = events.filter(
    (event) => isTransUnionOnboardingEvent(event) && landlordIdForEvent(event) === landlordId
  );

  const counts = scoped.reduce<Record<string, number>>((acc, event) => {
    const type = cleanString(event.type);
    if (!type) return acc;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const totals = {
    viewed: counts.tu_onboarding_viewed || 0,
    started: counts.tu_onboarding_started || 0,
    emailClicked: counts.tu_email_clicked || 0,
    phoneClicked: counts.tu_phone_clicked || 0,
    alreadyCredentialedClicked: counts.tu_already_credentialed_clicked || 0,
    connected: counts.tu_credentials_connected || 0,
  };

  return {
    totals,
    conversionRate: roundRatio(totals.connected, totals.started),
  };
}

export async function loadLandlordTransUnionOnboardingAnalytics(
  landlordId: string
): Promise<LandlordTransUnionOnboardingAnalytics> {
  const snapshot = await db.collection(CANONICAL_EVENTS_COLLECTION).get();
  const events = snapshot.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })) as CanonicalEventV1[];
  return deriveLandlordTransUnionOnboardingAnalytics(events, landlordId);
}
