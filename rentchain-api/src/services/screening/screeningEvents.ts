import { db } from "../../config/firebase";

export type ScreeningEventType =
  | "paid"
  | "processing_started"
  | "completed"
  | "failed"
  | "eligibility_checked"
  | "checkout_blocked"
  | "webhook_ignored"
  | "manual_complete"
  | "manual_fail"
  | "recomputed";

export type ScreeningEventActor = "system" | "admin" | "landlord";

export type ScreeningEventMeta = {
  reasonCode?: string;
  status?: string;
  stripeEventId?: string;
  sessionId?: string;
  from?: string;
  to?: string;
};

export async function writeScreeningEvent(params: {
  applicationId: string;
  landlordId: string | null;
  type: ScreeningEventType;
  at?: number;
  meta?: ScreeningEventMeta;
  actor: ScreeningEventActor;
}) {
  const { applicationId, landlordId, type, meta, actor } = params;
  const at = typeof params.at === "number" ? params.at : Date.now();
  const eventRef = db.collection("screeningEvents").doc();
  await eventRef.set({
    applicationId,
    landlordId: landlordId || "",
    type,
    at,
    meta: meta || {},
    actor,
  });
}
