import { describe, expect, it } from "vitest";
import {
  buildTenantApplicationEntryPath,
  buildTenantApplicationFlow,
} from "./tenantApplicationFlow";
import type { TenantApplicationReuseView } from "./tenantApplicationReuse";

function makeReuse(overrides?: Partial<TenantApplicationReuseView>): TenantApplicationReuseView {
  return {
    metrics: [],
    reusableProfileItems: [
      {
        label: "Profile basics",
        status: "ready",
        detail: "Ready",
        actionPath: "/tenant/profile",
        actionLabel: "Review your profile",
      },
    ],
    documentItems: [
      {
        label: "Ready to share",
        status: "ready",
        detail: "Ready",
        actionPath: "/tenant/attachments",
        actionLabel: "Open documents",
      },
    ],
    missingItems: [],
    shareInsights: [],
    ...overrides,
  };
}

describe("tenant application flow helper", () => {
  it("builds normalized tenant application entry paths", () => {
    expect(buildTenantApplicationEntryPath()).toBe("/tenant/application");
    expect(buildTenantApplicationEntryPath({ entry: "application", token: "app-123" })).toBe(
      "/tenant/application?entry=application&applicationToken=app-123"
    );
    expect(buildTenantApplicationEntryPath({ entry: "invite", token: "invite-123" })).toBe(
      "/tenant/application?entry=invite&inviteToken=invite-123"
    );
  });

  it("returns needs attention when required items are missing", () => {
    const view = buildTenantApplicationFlow({
      search: "?entry=invite&inviteToken=invite-123",
      completion: {
        status: "in_progress",
        progressPercent: 42,
        sections: [],
        nextSteps: ["Upload ID"],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      reuse: makeReuse({
        missingItems: [
          {
            label: "Government ID",
            status: "needs_attention",
            detail: "Upload your ID",
            actionPath: "/tenant/attachments",
            actionLabel: "Open documents",
          },
        ],
      }),
    });

    expect(view.entry).toBe("invite");
    expect(view.state).toBe("needs_attention");
    expect(view.nextStepPath).toBe("/tenant/attachments");
    expect(view.steps[1]?.status).toBe("current");
  });

  it("returns ready to review for in-progress reusable application links", () => {
    const view = buildTenantApplicationFlow({
      search: "?entry=application&applicationToken=app-123",
      completion: {
        status: "in_progress",
        progressPercent: 74,
        sections: [],
        nextSteps: [],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      reuse: makeReuse(),
    });

    expect(view.entry).toBe("application");
    expect(view.state).toBe("ready_to_review");
    expect(view.nextStepPath).toBe("/tenant/application");
  });

  it("returns ready to proceed for complete direct navigation", () => {
    const view = buildTenantApplicationFlow({
      search: "",
      completion: {
        status: "completed",
        progressPercent: 100,
        sections: [],
        nextSteps: [],
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
      reuse: makeReuse(),
    });

    expect(view.entry).toBe("direct");
    expect(view.state).toBe("ready_to_proceed");
    expect(view.nextStepPath).toBe("/tenant/access");
    expect(view.steps[3]?.status).toBe("current");
  });
});
