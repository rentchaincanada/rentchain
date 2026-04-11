import type { StructuredNotificationItem, StructuredNotificationTriggerType } from "./structuredNotificationTriggers";

export type NotificationPreferenceCategory =
  | "follow_up_requested"
  | "ready_for_rereview"
  | "application_updated"
  | "access_changed"
  | "documents_updated";

export type NotificationChannel = "in_app";

export type NotificationChannelPreferences = {
  inApp: Record<NotificationPreferenceCategory, boolean>;
};

export type NotificationRoutingDecision = {
  category: NotificationPreferenceCategory;
  eligibleChannels: NotificationChannel[];
  effectiveChannels: NotificationChannel[];
  blockedChannels: NotificationChannel[];
};

export const NOTIFICATION_PREFERENCE_CATEGORIES: Array<{
  key: NotificationPreferenceCategory;
  label: string;
  description: string;
}> = [
  {
    key: "follow_up_requested",
    label: "Follow-up requested",
    description: "Important updates when your application still needs attention.",
  },
  {
    key: "ready_for_rereview",
    label: "Ready for re-review",
    description: "Updates when requested follow-up now appears ready to review again.",
  },
  {
    key: "application_updated",
    label: "Application updated",
    description: "Progress updates for readiness and other application changes.",
  },
  {
    key: "access_changed",
    label: "Access updated",
    description: "Changes to supported access and sharing activity.",
  },
  {
    key: "documents_updated",
    label: "Documents updated",
    description: "Changes in your tenant document workspace.",
  },
];

export const DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES: NotificationChannelPreferences = {
  inApp: {
    follow_up_requested: true,
    ready_for_rereview: true,
    application_updated: true,
    access_changed: true,
    documents_updated: true,
  },
};

export function getNotificationPreferenceCategory(
  type: StructuredNotificationTriggerType
): NotificationPreferenceCategory {
  switch (type) {
    case "follow_up_requested":
      return "follow_up_requested";
    case "ready_for_rereview":
      return "ready_for_rereview";
    case "access_changed":
      return "access_changed";
    case "documents_updated":
      return "documents_updated";
    case "follow_up_addressed":
    case "readiness_improved":
    default:
      return "application_updated";
  }
}

export function normalizeNotificationChannelPreferences(
  input: Partial<NotificationChannelPreferences> | null | undefined
): NotificationChannelPreferences {
  const next: NotificationChannelPreferences = {
    inApp: { ...DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES.inApp },
  };

  if (!input?.inApp) {
    return next;
  }

  for (const category of NOTIFICATION_PREFERENCE_CATEGORIES) {
    if (typeof input.inApp[category.key] === "boolean") {
      next.inApp[category.key] = input.inApp[category.key];
    }
  }

  return next;
}

export function resolveNotificationChannels(params: {
  type: StructuredNotificationTriggerType;
  preferences?: Partial<NotificationChannelPreferences> | null;
  supportedChannels?: NotificationChannel[];
}): NotificationRoutingDecision {
  const category = getNotificationPreferenceCategory(params.type);
  const supportedChannels = params.supportedChannels?.length ? params.supportedChannels : ["in_app"];
  const normalized = normalizeNotificationChannelPreferences(params.preferences);
  const eligibleChannels = supportedChannels.filter((channel): channel is NotificationChannel => channel === "in_app");
  const effectiveChannels = eligibleChannels.filter((channel) => {
    if (channel === "in_app") return normalized.inApp[category];
    return false;
  });

  return {
    category,
    eligibleChannels,
    effectiveChannels,
    blockedChannels: eligibleChannels.filter((channel) => !effectiveChannels.includes(channel)),
  };
}

export function filterStructuredNotificationsByPreferences(
  items: StructuredNotificationItem[],
  preferences?: Partial<NotificationChannelPreferences> | null
): StructuredNotificationItem[] {
  return items.filter((item) => resolveNotificationChannels({ type: item.type, preferences }).effectiveChannels.includes("in_app"));
}
