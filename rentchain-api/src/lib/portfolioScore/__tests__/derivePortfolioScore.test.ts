import { describe, expect, it } from "vitest";
import type { CanonicalEventV1 } from "../../events/eventTypes";
import { derivePortfolioScore } from "../derivePortfolioScore";
import type { PortfolioScoreSignals } from "../loadPortfolioScoreSignals";

function event(input: Partial<CanonicalEventV1>): CanonicalEventV1 {
  return {
    id: input.id || "event-1",
    version: "v1",
    type: input.type || "system.event",
    domain: input.domain || "system",
    action: input.action || "observed",
    actor: input.actor || { type: "system", id: "system", role: "system" },
    resource: input.resource || { type: "resource", id: "resource-1" },
    occurredAt: input.occurredAt || "2026-04-15T12:00:00.000Z",
    recordedAt: input.recordedAt || "2026-04-15T12:00:00.000Z",
    visibility: input.visibility || "internal",
    summary: input.summary || "Event",
    status: input.status || null,
    metadata: input.metadata,
    metrics: input.metrics,
    tags: input.tags,
  };
}

function buildSignals(overrides?: Partial<PortfolioScoreSignals>): PortfolioScoreSignals {
  return {
    portfolioId: "portfolio-1",
    applications: [],
    maintenanceRequests: [],
    leases: [],
    canonicalEvents: [],
    screeningOrders: [],
    financialTransactions: [],
    applicationInsights: [],
    maintenanceInsights: [],
    leaseInsights: [],
    screeningReconciliations: [],
    triageItems: [],
    policyEvents: [],
    automationEvents: [],
    ...overrides,
  };
}

describe("derivePortfolioScore", () => {
  it("derives a deterministic score with weighted components", () => {
    const result = derivePortfolioScore(
      buildSignals({
        applications: [{ id: "app-1" }, { id: "app-2" }],
        maintenanceRequests: [{ id: "maint-1" }],
        leases: [{ id: "lease-1" }],
        applicationInsights: [
          {
            version: "v1",
            resourceType: "rental_application",
            resourceId: "app-1",
            domain: "application",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "submitted",
              eventCount: 2,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-12T10:00:00.000Z",
              durationMs: 1000,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
          {
            version: "v1",
            resourceType: "rental_application",
            resourceId: "app-2",
            domain: "screening",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "completed",
              eventCount: 4,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-13T10:00:00.000Z",
              durationMs: 2000,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        maintenanceInsights: [
          {
            version: "v1",
            resourceType: "maintenance_request",
            resourceId: "maint-1",
            domain: "maintenance",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "completed",
              eventCount: 3,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-11T10:00:00.000Z",
              durationMs: 1000,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        leaseInsights: [
          {
            version: "v1",
            resourceType: "lease",
            resourceId: "lease-1",
            domain: "lease",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "activated",
              eventCount: 2,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-11T10:00:00.000Z",
              durationMs: 1000,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        screeningReconciliations: [
          {
            version: "v1",
            applicationId: "app-2",
            generatedAt: "2026-04-15T12:00:00.000Z",
            status: "fulfilled",
            summary: {
              hasQuote: true,
              hasCheckout: true,
              hasPaidEvent: true,
              hasFulfillment: true,
              hasBlockedEvent: false,
              hasDuplicateRisk: false,
              hasMismatch: false,
              lastMeaningfulEventAt: "2026-04-13T10:00:00.000Z",
            },
            metrics: {},
            reasons: [],
            linkedIds: {},
          },
        ],
        policyEvents: [
          event({
            id: "policy-1",
            type: "policy.evaluated",
            domain: "policy",
            action: "evaluated",
            status: "allow",
            metadata: { outcome: "allow" },
          }),
        ],
        automationEvents: [
          event({
            id: "automation-1",
            type: "automation.executed",
            metadata: { executed: true },
          }),
        ],
      })
    );

    expect(result.score).toBeGreaterThan(80);
    expect(result.grade).toMatch(/[AB]/);
    expect(result.components).toHaveLength(6);
    expect(
      result.components.reduce((sum, component) => sum + component.weight, 0)
    ).toBeCloseTo(1, 5);
  });

  it("maps score bands to grades deterministically", () => {
    const low = derivePortfolioScore(
      buildSignals({
        applications: [{ id: "app-1" }],
        applicationInsights: [
          {
            version: "v1",
            resourceType: "rental_application",
            resourceId: "app-1",
            domain: "application",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "created",
              eventCount: 1,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-10T10:00:00.000Z",
              durationMs: 0,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        screeningReconciliations: [
          {
            version: "v1",
            applicationId: "app-1",
            generatedAt: "2026-04-15T12:00:00.000Z",
            status: "mismatch",
            summary: {
              hasQuote: true,
              hasCheckout: true,
              hasPaidEvent: false,
              hasFulfillment: true,
              hasBlockedEvent: false,
              hasDuplicateRisk: false,
              hasMismatch: true,
              lastMeaningfulEventAt: "2026-04-13T10:00:00.000Z",
            },
            metrics: {},
            reasons: [],
            linkedIds: {},
          },
        ],
        triageItems: [
          {
            id: "triage-1",
            version: "v1",
            category: "screening_reconciliation",
            severity: "critical",
            resource: { type: "application", id: "app-1" },
            reason: { code: "TRIAGE_SCREENING_MISMATCH", summary: "Mismatch" },
            signals: {},
            timestamps: { surfacedAt: "2026-04-15T12:00:00.000Z" },
            navigation: { supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1" },
            tags: [],
          },
        ],
        automationEvents: [
          event({
            id: "automation-1",
            type: "automation.skipped",
            metadata: { skipped: true, reason: "SCREENING_AUTO_START_CHECKOUT_POLICY_BLOCKED" },
          }),
        ],
        policyEvents: [
          event({
            id: "policy-1",
            type: "policy.evaluated",
            domain: "policy",
            action: "evaluated",
            status: "block",
            metadata: { outcome: "block" },
          }),
        ],
      })
    );

    expect(["D", "E"]).toContain(low.grade);
    expect(low.summary.status).toBe("at_risk");
  });

  it("returns a stable sparse-data payload", () => {
    const result = derivePortfolioScore(buildSignals());
    expect(result.portfolioId).toBe("portfolio-1");
    expect(result.components).toHaveLength(6);
    expect(result.summary.notes.some((note) => /Sparse portfolio data/i.test(note))).toBe(true);
  });

  it("penalizes severe reconciliation burden and triage load", () => {
    const healthy = derivePortfolioScore(
      buildSignals({
        applications: [{ id: "app-1" }],
        applicationInsights: [
          {
            version: "v1",
            resourceType: "rental_application",
            resourceId: "app-1",
            domain: "application",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "submitted",
              eventCount: 2,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-11T10:00:00.000Z",
              durationMs: 1000,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        screeningReconciliations: [
          {
            version: "v1",
            applicationId: "app-1",
            generatedAt: "2026-04-15T12:00:00.000Z",
            status: "fulfilled",
            summary: {
              hasQuote: true,
              hasCheckout: true,
              hasPaidEvent: true,
              hasFulfillment: true,
              hasBlockedEvent: false,
              hasDuplicateRisk: false,
              hasMismatch: false,
              lastMeaningfulEventAt: "2026-04-13T10:00:00.000Z",
            },
            metrics: {},
            reasons: [],
            linkedIds: {},
          },
        ],
      })
    );
    const unhealthy = derivePortfolioScore(
      buildSignals({
        applications: [{ id: "app-1" }],
        applicationInsights: [
          {
            version: "v1",
            resourceType: "rental_application",
            resourceId: "app-1",
            domain: "application",
            generatedAt: "2026-04-15T12:00:00.000Z",
            summary: {
              lifecycleState: "created",
              eventCount: 1,
              blockedCount: 0,
              reopenCount: 0,
              firstEventAt: "2026-04-10T10:00:00.000Z",
              lastEventAt: "2026-04-10T10:00:00.000Z",
              durationMs: 0,
            },
            metrics: {},
            tags: [],
            notes: [],
          },
        ],
        screeningReconciliations: [
          {
            version: "v1",
            applicationId: "app-1",
            generatedAt: "2026-04-15T12:00:00.000Z",
            status: "paid_not_fulfilled",
            summary: {
              hasQuote: true,
              hasCheckout: true,
              hasPaidEvent: true,
              hasFulfillment: false,
              hasBlockedEvent: false,
              hasDuplicateRisk: false,
              hasMismatch: false,
              lastMeaningfulEventAt: "2026-04-13T10:00:00.000Z",
            },
            metrics: {},
            reasons: [],
            linkedIds: {},
          },
        ],
        triageItems: [
          {
            id: "triage-1",
            version: "v1",
            category: "screening_reconciliation",
            severity: "critical",
            resource: { type: "application", id: "app-1" },
            reason: { code: "TRIAGE_PAID_NOT_FULFILLED", summary: "Payment recorded but completion missing" },
            signals: {},
            timestamps: { surfacedAt: "2026-04-15T12:00:00.000Z" },
            navigation: { supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1" },
            tags: [],
          },
        ],
      })
    );

    expect(unhealthy.score).toBeLessThan(healthy.score);
  });
});
