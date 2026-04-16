import { describe, expect, it } from "vitest";
import { deriveNotifications } from "../deriveNotifications";

describe("deriveNotifications", () => {
  it("derives notification types from alerts and preserves navigation", () => {
    const notifications = deriveNotifications({
      alerts: [
        {
          version: "v1",
          id: "alert-1",
          category: "screening_reconciliation",
          severity: "critical",
          resource: { type: "application", id: "app-1", portfolioId: "portfolio-1" },
          reason: { code: "ALERT_SCREENING_MISMATCH", summary: "Screening reconciliation signals are inconsistent." },
          signals: { triageCategory: "screening_reconciliation", triageSeverity: "critical" },
          state: { isActive: true, isAcknowledged: false },
          timestamps: {
            createdAt: "2026-04-16T12:00:00.000Z",
            updatedAt: "2026-04-16T12:00:00.000Z",
            lastSeenAt: "2026-04-16T12:00:00.000Z",
          },
          navigation: {
            supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1",
            triagePath: "/admin/triage?resourceType=application",
            portfolioScorePath: "/admin/portfolio-score?portfolioId=portfolio-1",
          },
          tags: [],
        } as any,
      ],
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual(
      expect.objectContaining({
        type: "triage_item",
        severity: "critical",
        navigation: expect.objectContaining({
          supportConsolePath: expect.stringContaining("/admin/support-console"),
          triagePath: expect.stringContaining("/admin/triage"),
          portfolioScorePath: expect.stringContaining("/admin/portfolio-score"),
        }),
      })
    );
  });

  it("derives sla escalation and portfolio score change notifications correctly", () => {
    const notifications = deriveNotifications({
      alerts: [
        {
          version: "v1",
          id: "alert-sla",
          category: "maintenance_friction",
          severity: "high",
          resource: { type: "maintenance", id: "maint-1", portfolioId: "portfolio-1" },
          reason: { code: "ALERT_WORKFLOW_STALLED", summary: "Maintenance work has stalled." },
          signals: { triageCategory: "workflow_stall", triageSeverity: "high" },
          sla: { stage: "escalated", escalationLevel: "critical", ageHours: 49 },
          state: { isActive: true, isAcknowledged: false },
          timestamps: {
            createdAt: "2026-04-16T12:00:00.000Z",
            updatedAt: "2026-04-16T12:00:00.000Z",
            lastSeenAt: "2026-04-16T12:00:00.000Z",
          },
          navigation: {},
          tags: [],
        } as any,
        {
          version: "v1",
          id: "alert-portfolio",
          category: "portfolio_score_change",
          severity: "high",
          resource: { type: "portfolio", id: "portfolio-1", portfolioId: "portfolio-1" },
          reason: { code: "ALERT_PORTFOLIO_SCORE_DROP", summary: "Portfolio score declined versus the previous snapshot." },
          signals: { portfolioScore: 74, portfolioScoreDelta: -6 },
          state: { isActive: true, isAcknowledged: false },
          timestamps: {
            createdAt: "2026-04-16T12:00:00.000Z",
            updatedAt: "2026-04-16T12:00:00.000Z",
            lastSeenAt: "2026-04-16T12:00:00.000Z",
          },
          navigation: { portfolioScorePath: "/admin/portfolio-score?portfolioId=portfolio-1" },
          tags: [],
        } as any,
      ],
    });

    expect(notifications.map((item) => item.type)).toEqual(
      expect.arrayContaining(["sla_escalation", "portfolio_score_change"])
    );
  });

  it("applies read state and watcher delivery", () => {
    const notifications = deriveNotifications({
      alerts: [
        {
          version: "v1",
          id: "alert-1",
          category: "screening_reconciliation",
          severity: "high",
          resource: { type: "application", id: "app-1", portfolioId: "portfolio-1" },
          reason: { code: "ALERT_DUPLICATE_RISK", summary: "Duplicate risk needs review." },
          signals: { triageCategory: "screening_reconciliation", triageSeverity: "high" },
          state: { isActive: true, isAcknowledged: false },
          timestamps: {
            createdAt: "2026-04-16T12:00:00.000Z",
            updatedAt: "2026-04-16T12:00:00.000Z",
            lastSeenAt: "2026-04-16T12:00:00.000Z",
          },
          navigation: {},
          tags: [],
        } as any,
      ],
      watchlist: [
        {
          version: "v1",
          id: "watch-1",
          target: { type: "portfolio", id: "portfolio-1" },
          createdAt: "2026-04-16T12:00:00.000Z",
          updatedAt: "2026-04-16T12:00:00.000Z",
          isActive: true,
        } as any,
      ],
      notificationStates: [
        {
          id: "notification-triage_item-alert-1",
          status: "read",
          readAt: "2026-04-16T13:00:00.000Z",
          updatedAt: "2026-04-16T13:00:00.000Z",
        },
      ],
    });

    expect(notifications[0].watched).toBe(true);
    expect(notifications[0].state.status).toBe("read");
    expect(notifications[0].state.readAt).toBe("2026-04-16T13:00:00.000Z");
  });
});
