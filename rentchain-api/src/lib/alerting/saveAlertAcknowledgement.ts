import { db } from "../../config/firebase";
import { ADMIN_ALERT_STATES_COLLECTION } from "./loadAlertStates";

export async function saveAlertAcknowledgement(input: {
  alertId: string;
  acknowledged: boolean;
  acknowledgedBy?: string | null;
}) {
  const now = new Date().toISOString();
  const payload = {
    id: input.alertId,
    acknowledged: input.acknowledged,
    acknowledgedAt: input.acknowledged ? now : null,
    acknowledgedBy: input.acknowledged ? input.acknowledgedBy || null : null,
    updatedAt: now,
  };
  await db.collection(ADMIN_ALERT_STATES_COLLECTION).doc(input.alertId).set(payload, { merge: false });
  return payload;
}
