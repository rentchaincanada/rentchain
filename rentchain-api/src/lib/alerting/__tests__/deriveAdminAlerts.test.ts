import { describe, expect, it } from "vitest";
import { deriveAdminAlerts } from "../deriveAdminAlerts";

describe("deriveAdminAlerts", () => {
  it("derives screening reconciliation alerts deterministically", () => {
    const alerts = deriveAdminAlerts({
      triageItems: [
        {
          id: "triage-1",
          version: "v1",
          category: "screening_reconciliation",
          severity: "critical",
          resource: { type: "application", id: "app-1", title: "Application app-1", status: "mismatch" },
          reason: { code: "TRIAGE_SCREENING_MISMATCH", summary: "Signals mismatch." },
          signals: { reconciliationStatus: "mismatch" },
          timestamps: { surfacedAt: "2026-04-16T12:00:00.000Z" },
          navigation: {},
          tags: ["screening"],
        },
      ],
    });

    expect(alerts).toEqual([
      expect.objectContaining({
        category: "screening_reconciliation",
        severity: "critical",
        reason: expect.objectContaining({
          code: "ALERT_SCREENING_MISMATCH",
        }),
      }),
    ]);
  });

  it("derives portfolio score decline and stale resolution alerts", () => {
    const alerts = deriveAdminAlerts({
      portfolioTrends: [
        {
          version: "v1",
          portfolioId: "landlord-1",
          generatedAt: "2026-04-16T12:00:00.000Z",
          latest: {
            version: "v1",
            portfolioId: "landlord-1",
            snapshotAt: "2026-04-16T12:00:00.000Z",
            score: 70,
            grade: "C",
            status: "watch",
            headline: "Portfolio declined.",
            componentScores: [],
            metrics: {
              totalResourcesReviewed: 10,
              triageItemCount: 4,
              criticalTriageCount: 1,
              reconciliationIssueCount: 2,
              automationSkipCount: 1,
              policyReviewCount: 1,
              blockedWorkflowCount: 1,
              maintenanceReopenCount: 0,
            },
          },
          previous: {
            version: "v1",
            portfolioId: "landlord-1",
            snapshotAt: "2026-04-01T12:00:00.000Z",
            score: 76,
            grade: "B",
            status: "healthy",
            headline: "Portfolio healthy.",
            componentScores: [],
            metrics: {
              totalResourcesReviewed: 10,
              triageItemCount: 1,
              criticalTriageCount: 0,
              reconciliationIssueCount: 0,
              automationSkipCount: 0,
              policyReviewCount: 0,
              blockedWorkflowCount: 0,
              maintenanceReopenCount: 0,
            },
          },
          direction: "down",
          deltaScore: -6,
          deltaGrade: "B -> C",
          summary: {
            headline: "Portfolio score declined.",
            notes: ["Exception burden increased."],
          },
          movers: [],
          history: [],
        },
      ],
      resolutions: [
        {
          version: "v1",
          id: "resolution-1",
          resource: { type: "application", id: "app-2" },
          triage: { severity: "high", reasonCode: "TRIAGE_PAID_NOT_FULFILLED" },
          status: "open",
          createdAt: "2026-04-14T09:00:00.000Z",
          updatedAt: "2026-04-14T09:00:00.000Z",
          notes: [],
          history: [],
        },
      ],
      now: Date.parse("2026-04-16T12:00:00.000Z"),
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "portfolio_score_change",
          reason: expect.objectContaining({ code: "ALERT_PORTFOLIO_GRADE_DROP" }),
        }),
        expect.objectContaining({
          category: "resolution_attention",
          reason: expect.objectContaining({ code: "ALERT_RESOLUTION_STALE" }),
        }),
      ])
    );
  });

  it("keeps deterministic alert ids stable", () => {
    const input = {
      triageItems: [
        {
          id: "triage-1",
          version: "v1",
          category: "automation_exception",
          severity: "high",
          resource: { type: "lease", id: "lease-1" },
          reason: { code: "TRIAGE_AUTOMATION_SKIPPED", summary: "Skipped." },
          signals: {},
          timestamps: { surfacedAt: "2026-04-16T12:00:00.000Z" },
          navigation: {},
          tags: [],
        },
      ],
    };
    const first = deriveAdminAlerts(input)[0];
    const second = deriveAdminAlerts(input)[0];
    expect(first.id).toBe(second.id);
  });
});
