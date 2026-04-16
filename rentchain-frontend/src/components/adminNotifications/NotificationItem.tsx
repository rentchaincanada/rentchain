import React from "react";
import type { AdminNotificationV1 } from "../../api/adminNotificationApi";
import { Button, Card } from "../ui/Ui";
import NotificationBadge from "./NotificationBadge";

export default function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: AdminNotificationV1;
  onMarkRead: (notification: AdminNotificationV1) => void | Promise<void>;
}) {
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <NotificationBadge tone={notification.severity || "default"}>
              {notification.severity || notification.type}
            </NotificationBadge>
            <NotificationBadge>{notification.state.status}</NotificationBadge>
            {notification.watched ? <NotificationBadge tone="low">watched</NotificationBadge> : null}
          </div>
          <div style={{ fontWeight: 700 }}>{notification.summary.title}</div>
          <div style={{ color: "#475569" }}>{notification.summary.message}</div>
        </div>
        {notification.state.status === "unread" ? (
          <Button type="button" variant="secondary" onClick={() => void onMarkRead(notification)}>
            Mark read
          </Button>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#64748b", fontSize: "0.9rem" }}>
        <span>{`${notification.resource.type} ${notification.resource.id}`}</span>
        {notification.navigation.supportConsolePath ? (
          <a href={notification.navigation.supportConsolePath}>Support console</a>
        ) : null}
        {notification.navigation.triagePath ? <a href={notification.navigation.triagePath}>Triage</a> : null}
        {notification.navigation.portfolioScorePath ? (
          <a href={notification.navigation.portfolioScorePath}>Portfolio score</a>
        ) : null}
      </div>
    </Card>
  );
}
