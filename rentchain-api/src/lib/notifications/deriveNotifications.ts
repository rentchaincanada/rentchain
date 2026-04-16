import type { AdminAlertV1 } from "../alerting/alertingTypes";
import type { WatchlistEntryV1 } from "../watchlist/watchlistTypes";
import type { AdminNotificationStateRecord } from "./loadNotifications";
import type { AdminNotificationV1, NotificationType } from "./notificationTypes";

type DeriveNotificationsInput = {
  alerts?: AdminAlertV1[];
  watchlist?: WatchlistEntryV1[];
  notificationStates?: AdminNotificationStateRecord[];
  resourcePortfolioIds?: Record<string, string | null | undefined>;
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function resourceKey(resourceType: string, resourceId: string) {
  return `${resourceType}:${resourceId}`;
}

function notificationId(type: NotificationType, sourceId: string) {
  return `notification-${type}-${sourceId}`;
}

function severityRank(severity?: string | null) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[asString(severity, 40) as "critical"] || 0;
}

function isWatched(alert: AdminAlertV1, watchlist: WatchlistEntryV1[], portfolioId?: string | null) {
  return watchlist.some((entry) => {
    if (!entry.isActive) return false;
    const targetType = asString(entry.target?.type, 80);
    const targetId = asString(entry.target?.id, 240);
    if (targetType === alert.resource.type && targetId === alert.resource.id) return true;
    if (targetType === "portfolio" && portfolioId && targetId === portfolioId) return true;
    return false;
  });
}

function resolveType(alert: AdminAlertV1): NotificationType {
  if (alert.category === "portfolio_score_change") return "portfolio_score_change";
  if (
    alert.sla?.stage === "overdue" ||
    alert.sla?.stage === "escalated" ||
    alert.sla?.escalationLevel === "high" ||
    alert.sla?.escalationLevel === "critical"
  ) {
    return "sla_escalation";
  }
  if (alert.signals?.triageCategory || alert.signals?.triageSeverity) {
    return "triage_item";
  }
  return "alert";
}

function titleForNotification(type: NotificationType, alert: AdminAlertV1) {
  if (type === "portfolio_score_change") {
    return "Portfolio score changed";
  }
  if (type === "sla_escalation") {
    return alert.sla?.stage === "escalated"
      ? "Issue has escalated"
      : "Issue is overdue";
  }
  if (type === "triage_item") {
    return alert.severity === "critical"
      ? "Critical issue needs attention"
      : "Operational issue needs attention";
  }
  return "New alert requires attention";
}

function messageForNotification(type: NotificationType, alert: AdminAlertV1) {
  if (type === "portfolio_score_change") {
    return alert.reason.summary || "Portfolio health changed enough to warrant review.";
  }
  if (type === "sla_escalation") {
    const age = typeof alert.sla?.ageHours === "number" ? `${Math.round(alert.sla.ageHours)}h` : null;
    return age
      ? `${alert.reason.summary} This item has been open for about ${age}.`
      : alert.reason.summary;
  }
  return alert.reason.summary;
}

export function deriveNotifications(input: DeriveNotificationsInput): AdminNotificationV1[] {
  const alerts = input.alerts || [];
  const watchlist = input.watchlist || [];
  const stateById = new Map((input.notificationStates || []).map((item) => [item.id, item]));
  const portfolioIndex = input.resourcePortfolioIds || {};

  const notifications = alerts.map((alert) => {
    const type = resolveType(alert);
    const portfolioId =
      asString(alert.resource.portfolioId, 240) ||
      asString(portfolioIndex[resourceKey(alert.resource.type, alert.resource.id)], 240) ||
      (alert.resource.type === "portfolio" ? alert.resource.id : "");
    const watched = isWatched(alert, watchlist, portfolioId || null);
    const id = notificationId(type, alert.id);
    const state = stateById.get(id);
    return {
      version: "v1",
      id,
      type,
      resource: {
        type: alert.resource.type,
        id: alert.resource.id,
        portfolioId: portfolioId || null,
      },
      summary: {
        title: titleForNotification(type, alert),
        message: messageForNotification(type, alert),
      },
      severity: alert.severity,
      watched,
      state: {
        status: state?.status || "unread",
        readAt: state?.readAt || null,
      },
      createdAt: alert.timestamps.createdAt,
      updatedAt: state?.updatedAt || alert.timestamps.updatedAt || alert.timestamps.createdAt,
      navigation: {
        supportConsolePath: alert.navigation.supportConsolePath || null,
        triagePath: alert.navigation.triagePath || null,
        portfolioScorePath: alert.navigation.portfolioScorePath || null,
      },
    } satisfies AdminNotificationV1;
  });

  return notifications.sort((a, b) => {
    if (Number(Boolean(b.watched)) !== Number(Boolean(a.watched))) {
      return Number(Boolean(b.watched)) - Number(Boolean(a.watched));
    }
    if (a.state.status !== b.state.status) {
      return a.state.status === "unread" ? -1 : 1;
    }
    if (severityRank(b.severity) !== severityRank(a.severity)) {
      return severityRank(b.severity) - severityRank(a.severity);
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}
