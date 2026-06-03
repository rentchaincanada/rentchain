import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => buildQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        let rows = Array.from(ensureCollection(name).values());
        rows = rows.filter((entry) =>
          filters.every((f) => {
            const value = entry.data?.[f.field];
            if (f.op === ">=") return Number(value || 0) >= Number(f.value);
            if (f.op === "<=") return Number(value || 0) <= Number(f.value);
            return true;
          })
        );
        return {
          empty: rows.length === 0,
          docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
        };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      }),
    },
    resetDb: () => {
      collections.clear();
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

describe("adminSubscriptionConversionInsights", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("computes ranked surfaces, plan interest, weakest step, and deterministic recommendations", async () => {
    const now = Date.now();
    seedDoc("events", "event-1", {
      name: "pricing_page_viewed",
      ts: now - 1_000,
      props: { surface: "marketing_pricing", source: "marketing_pricing" },
    });
    seedDoc("events", "event-2", {
      name: "pricing_plan_cta_clicked",
      ts: now - 900,
      props: { targetPlan: "starter", surface: "marketing_pricing", source: "marketing_pricing" },
    });
    seedDoc("events", "event-3", {
      name: "billing_page_opened",
      ts: now - 800,
      props: { surface: "billing_page", source: "billing_page" },
    });
    seedDoc("events", "event-4", {
      name: "billing_upgrade_clicked",
      ts: now - 700,
      props: { targetPlan: "starter", surface: "billing_page", source: "billing_page" },
    });
    seedDoc("events", "event-5", {
      name: "upgrade_cta_clicked",
      ts: now - 650,
      props: {
        featureKey: "tenant_invites",
        surface: "locked_feature",
        source: "applications_page",
      },
    });
    seedDoc("events", "mixed-1", {
      type: "application_submitted",
      occurredAt: new Date(now - 600).toISOString(),
      payload: {},
    });

    const { loadAdminSubscriptionConversionInsights } = await import("../admin/adminSubscriptionConversionInsights");
    const result = await loadAdminSubscriptionConversionInsights({ days: 30 });

    expect(result.insights.strongestSurface).toEqual({
      surface: "billing_page",
      count: 1,
    });
    expect(result.insights.strongestPlanInterest).toEqual({
      targetPlan: "starter",
      count: 2,
    });
    expect(result.insights.weakestFunnelStep).toEqual({
      step: "upgrade_cta_clicked -> upgrade_prompt_viewed",
      conversion: 0,
    });
    expect(result.insights.strongestFeatureSignal).toEqual({
      featureKey: "tenant_invites",
      count: 1,
    });
    expect(result.breakdowns.featureKey).toEqual({
      tenant_invites: 1,
    });
    expect(result.recommendations).toContain("Preserve billing as the primary upgrade hub.");
    expect(result.recommendations).toContain(
      "Strengthen Pro and Elite differentiation if Starter continues to dominate upgrade interest."
    );
    expect(result.recommendations).toContain(
      "Monitor whether prompt-driven upgrade flows become meaningful before prioritizing prompt optimization."
    );
    expect(result.recommendations).toContain(
      "Treat this output as directional until more conversion event volume accumulates."
    );
  });

  it("returns safe empty insight output when no matching analytics events exist", async () => {
    const { loadAdminSubscriptionConversionInsights } = await import("../admin/adminSubscriptionConversionInsights");
    const result = await loadAdminSubscriptionConversionInsights({ days: 7 });

    expect(result.insights.strongestSurface).toEqual({
      surface: null,
      count: 0,
    });
    expect(result.insights.strongestPlanInterest).toEqual({
      targetPlan: null,
      count: 0,
    });
    expect(result.insights.weakestFunnelStep).toEqual({
      step: null,
      conversion: null,
    });
    expect(result.recommendations).toEqual([
      "Monitor whether prompt-driven upgrade flows become meaningful before prioritizing prompt optimization.",
    ]);
  });
});
