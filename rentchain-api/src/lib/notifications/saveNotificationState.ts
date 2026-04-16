import { db } from "../../config/firebase";
import { ADMIN_NOTIFICATIONS_COLLECTION } from "./loadNotifications";

export async function saveNotificationState(input: {
  notificationId: string;
  read: boolean;
}) {
  const now = new Date().toISOString();
  const payload = {
    id: input.notificationId,
    status: input.read ? "read" : "unread",
    readAt: input.read ? now : null,
    updatedAt: now,
  };
  await db.collection(ADMIN_NOTIFICATIONS_COLLECTION).doc(input.notificationId).set(payload, {
    merge: false,
  });
  return payload;
}
