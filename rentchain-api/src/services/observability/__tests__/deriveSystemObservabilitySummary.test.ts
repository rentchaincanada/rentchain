import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, ensureCollection } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map<string, any>());
    return store.get(name)!;
  }

  return { store, ensureCollection };
});

vi.mock("../../../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      async get() {
        const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
          id,
          data: () => data,
        }));
        return { docs };
      },
    }),
  },
}));

describe("deriveSystemObservabilitySummary", () => {
  beforeEach(() => {
    store.clear();
  });

  it("aggregates warnings, critical issues, completions, and top issues deterministically", async () => {
    const events = ensureCollection("systemObservabilityEvents");
    events.set("evt-1", {
      id: "evt-1",
      version: "v1",
      eventType: "action_failed",
      workflow: "payment",
      severity: "warning",
      actorType: "system",
      status: "open",
      title: "Rent payment failed",
      description: "A payment failed.",
      safeContext: null,
      idempotencyKey: null,
      source: { kind: "system_observability", sourceEventId: null },
      occurredAt: "2026-04-26T12:00:00.000Z",
      recordedAt: "2026-04-26T12:00:00.000Z",
      resolvedAt: null,
    });
    events.set("evt-2", {
      id: "evt-2",
      version: "v1",
      eventType: "integration_warning",
      workflow: "screening",
      severity: "critical",
      actorType: "system",
      status: "open",
      title: "Screening webhook missing application context",
      description: "Webhook missing application metadata.",
      safeContext: null,
      idempotencyKey: null,
      source: { kind: "system_observability", sourceEventId: null },
      occurredAt: "2026-04-27T13:00:00.000Z",
      recordedAt: "2026-04-27T13:00:00.000Z",
      resolvedAt: null,
    });
    events.set("evt-3", {
      id: "evt-3",
      version: "v1",
      eventType: "workflow_completed",
      workflow: "lease",
      severity: "info",
      actorType: "tenant",
      status: "resolved",
      title: "Tenant lease signature recorded",
      description: "A tenant signature milestone was recorded.",
      safeContext: null,
      idempotencyKey: null,
      source: { kind: "system_observability", sourceEventId: null },
      occurredAt: "2026-04-28T08:00:00.000Z",
      recordedAt: "2026-04-28T08:00:00.000Z",
      resolvedAt: "2026-04-28T08:00:00.000Z",
    });

    const { deriveSystemObservabilitySummary } = await import("../deriveSystemObservabilitySummary");
    const summary = await deriveSystemObservabilitySummary({
      period: "7d",
      now: new Date("2026-04-28T18:00:00.000Z"),
    });

    expect(summary.totals).toEqual({
      openCritical: 1,
      openWarnings: 1,
      resolvedLast7Days: 1,
    });
    expect(summary.workflows.find((item) => item.workflow === "screening")).toEqual(
      expect.objectContaining({
        openCritical: 1,
        openWarnings: 0,
        recentCompleted: 0,
        health: "attention",
      })
    );
    expect(summary.workflows.find((item) => item.workflow === "payment")).toEqual(
      expect.objectContaining({
        openCritical: 0,
        openWarnings: 1,
        health: "watch",
      })
    );
    expect(summary.workflows.find((item) => item.workflow === "lease")).toEqual(
      expect.objectContaining({
        recentCompleted: 1,
        health: "healthy",
      })
    );
    expect(summary.topIssues[0]).toEqual(
      expect.objectContaining({
        title: "Screening webhook missing application context",
        workflow: "screening",
        severity: "critical",
        count: 1,
      })
    );
  });

  it("returns stable empty states when no observability events exist", async () => {
    const { deriveSystemObservabilitySummary } = await import("../deriveSystemObservabilitySummary");
    const summary = await deriveSystemObservabilitySummary({
      period: "30d",
      now: new Date("2026-04-28T18:00:00.000Z"),
    });

    expect(summary.totals).toEqual({
      openCritical: 0,
      openWarnings: 0,
      resolvedLast7Days: 0,
    });
    expect(summary.workflows.every((item) => item.health === "healthy")).toBe(true);
    expect(summary.topIssues).toEqual([]);
  });
});
