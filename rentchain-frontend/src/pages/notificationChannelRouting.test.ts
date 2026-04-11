import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES,
  filterStructuredNotificationsByPreferences,
  resolveNotificationChannels,
} from "./notificationChannelRouting";
import type { StructuredNotificationItem } from "./structuredNotificationTriggers";

describe("notificationChannelRouting", () => {
  it("routes follow-up requested notifications to in-app by default", () => {
    expect(resolveNotificationChannels({ type: "follow_up_requested" })).toMatchObject({
      category: "follow_up_requested",
      eligibleChannels: ["in_app"],
      effectiveChannels: ["in_app"],
      blockedChannels: [],
    });
  });

  it("blocks in-app delivery when a category is muted", () => {
    expect(
      resolveNotificationChannels({
        type: "documents_updated",
        preferences: {
          inApp: {
            ...DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES.inApp,
            documents_updated: false,
          },
        },
      })
    ).toMatchObject({
      category: "documents_updated",
      effectiveChannels: [],
      blockedChannels: ["in_app"],
    });
  });

  it("filters structured items to the effective in-app set", () => {
    const items: StructuredNotificationItem[] = [
      {
        id: "1",
        type: "follow_up_requested",
        title: "Follow-up requested",
        description: "Needs attention.",
        timestamp: 100,
        actionRequired: true,
        targetLink: "/tenant/application",
      },
      {
        id: "2",
        type: "documents_updated",
        title: "Documents updated",
        description: "Saved.",
        timestamp: 90,
        actionRequired: false,
        targetLink: "/tenant/attachments",
      },
    ];

    const result = filterStructuredNotificationsByPreferences(items, {
      inApp: {
        ...DEFAULT_NOTIFICATION_CHANNEL_PREFERENCES.inApp,
        documents_updated: false,
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });
});
