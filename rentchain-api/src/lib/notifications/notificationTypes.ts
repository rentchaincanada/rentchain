export type NotificationType =
  | "alert"
  | "sla_escalation"
  | "triage_item"
  | "portfolio_score_change";

export type NotificationStatus = "unread" | "read";

export type AdminNotificationV1 = {
  version: "v1";
  id: string;
  type: NotificationType;
  resource: {
    type: string;
    id: string;
    portfolioId?: string | null;
  };
  summary: {
    title: string;
    message: string;
  };
  severity?: "low" | "medium" | "high" | "critical";
  watched?: boolean;
  state: {
    status: NotificationStatus;
    readAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  navigation: {
    supportConsolePath?: string | null;
    triagePath?: string | null;
    portfolioScorePath?: string | null;
  };
};
