import { db } from "../../config/firebase";

export const ADMIN_ALERT_STATES_COLLECTION = "adminAlertStates";

export type AdminAlertStateRecord = {
  id: string;
  acknowledged: boolean;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  updatedAt: string;
};

export async function loadAlertStates(): Promise<AdminAlertStateRecord[]> {
  const snap = await db.collection(ADMIN_ALERT_STATES_COLLECTION).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as AdminAlertStateRecord);
}
