import React from "react";
import type { AdminNotificationV1 } from "../../api/adminNotificationApi";
import NotificationItem from "./NotificationItem";

export default function NotificationList({
  notifications,
  onMarkRead,
}: {
  notifications: AdminNotificationV1[];
  onMarkRead: (notification: AdminNotificationV1) => void | Promise<void>;
}) {
  if (!notifications.length) {
    return <div>No notifications are active right now.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={onMarkRead}
        />
      ))}
    </div>
  );
}
