import { db } from "../../firebase";
import type { NotificationStatus } from "./notificationTypes";

export const ADMIN_NOTIFICATIONS_COLLECTION = "adminNotifications";

export type AdminNotificationStateRecord = {
  id: string;
  status: NotificationStatus;
  readAt?: string | null;
  updatedAt: string;
};

export async function loadNotificationStates(): Promise<AdminNotificationStateRecord[]> {
  const snap = await db.collection(ADMIN_NOTIFICATIONS_COLLECTION).get();
  return (snap.docs || []).map(
    (doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as AdminNotificationStateRecord
  );
}
