import { createHash } from "crypto";
import { db } from "../../config/firebase";

export type ScreeningReferralStatus = "initiated" | "completed" | "expired";
export type ScreeningReferralCompletionSource = "callback" | "manual" | "reconcile";

export type ScreeningReferralRecord = {
  referralId: string;
  provider: "transunion_referral";
  landlordIdHash: string;
  applicationId: string | null;
  orderId: string | null;
  createdAtMs: number;
  returnTo: string | null;
  status: ScreeningReferralStatus;
  completedAtMs: number | null;
  completionSource: ScreeningReferralCompletionSource | null;
  tuTrackingParams?: { source?: string; ts?: string } | null;
  version: number;
};

const REFERRAL_SCHEMA_VERSION = 1;

function asNonEmptyString(value: unknown): string | null {
  const v = String(value || "").trim();
  return v.length > 0 ? v : null;
}

export function hashLandlordId(landlordId: string): string {
  const full = createHash("sha256").update(String(landlordId || "")).digest("hex");
  return full.slice(0, 24);
}

export async function writeReferralInitiated(input: {
  referralId: string;
  landlordId: string;
  applicationId?: string | null;
  orderId?: string | null;
  returnTo?: string | null;
  tuTrackingParams?: { source?: string; ts?: string } | null;
}) {
  const referralId = asNonEmptyString(input.referralId);
  if (!referralId) return;

  const now = Date.now();
  const payload: ScreeningReferralRecord = {
    referralId,
    provider: "transunion_referral",
    landlordIdHash: hashLandlordId(input.landlordId),
    applicationId: asNonEmptyString(input.applicationId) || null,
    orderId: asNonEmptyString(input.orderId) || null,
    createdAtMs: now,
    returnTo: asNonEmptyString(input.returnTo) || null,
    status: "initiated",
    completedAtMs: null,
    completionSource: null,
    tuTrackingParams: input.tuTrackingParams || null,
    version: REFERRAL_SCHEMA_VERSION,
  };

  await db.collection("screeningReferrals").doc(referralId).set(payload, { merge: true });
}

export async function findReferralDoc(input: {
  referralId?: string | null;
  orderId?: string | null;
  applicationId?: string | null;
}) {
  const referralId = asNonEmptyString(input.referralId);
  const orderId = asNonEmptyString(input.orderId);
  const applicationId = asNonEmptyString(input.applicationId);

  if (referralId) {
    const doc = await db.collection("screeningReferrals").doc(referralId).get();
    if (doc.exists) return doc;
  }
  if (orderId) {
    const snap = await db
      .collection("screeningReferrals")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  if (applicationId) {
    const snap = await db
      .collection("screeningReferrals")
      .where("applicationId", "==", applicationId)
      .orderBy("createdAtMs", "desc")
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

export async function markReferralCompleted(input: {
  referralId?: string | null;
  orderId?: string | null;
  applicationId?: string | null;
  completionSource: ScreeningReferralCompletionSource;
}) {
  const doc = await findReferralDoc(input);
  if (!doc) return null;

  const now = Date.now();
  const fallbackRef: any = db.collection("screeningReferrals").doc(String((doc as any).id));
  const ref: any = (doc as any).ref && typeof (doc as any).ref.set === "function"
    ? (doc as any).ref
    : fallbackRef;
  await ref.set(
    {
      status: "completed",
      completedAtMs: now,
      completionSource: input.completionSource,
      updatedAtMs: now,
    },
    { merge: true }
  );
  const readRef: any = typeof ref.get === "function" ? ref : fallbackRef;
  const refreshed = await readRef.get();
  return refreshed.exists ? ({ id: refreshed.id, ...(refreshed.data() as any) } as any) : null;
}
