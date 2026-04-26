import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, queryLog } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  const queryLog: Array<{ collection: string; filters: Array<{ field: string; op: string; value: any }> }> = [];

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => buildQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        queryLog.push({ collection: name, filters });
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
      queryLog.length = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
    queryLog,
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("adminSubscriptionConversionView", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("builds a bounded funnel summary from Mission 29 analytics events only", async () => {
    const now = Date.now();
    seedDoc("events", "event-1", {
      name: "pricing_page_viewed",
      ts: now - 1_000,
      props: { surface: "pricing_page", source: "marketing_pricing" },
    });
    seedDoc("events", "event-2", {
      name: "pricing_plan_cta_clicked",
      ts: now - 900,
      props: { targetPlan: "pro", surface: "pricing_page", source: "marketing_pricing" },
    });
    seedDoc("events", "event-3", {
      name: "upgrade_prompt_viewed",
      ts: now - 800,
      props: { targetPlan: "pro", surface: "locked_feature", source: "applications_page" },
    });
    seedDoc("events", "event-4", {
      name: "upgrade_prompt_checkout_clicked",
      ts: now - 700,
      props: { targetPlan: "pro", surface: "locked_feature", source: "applications_page" },
    });
    seedDoc("events", "mixed-1", {
      type: "application_submitted",
      occurredAt: new Date(now - 600).toISOString(),
      payload: {},
    });
    seedDoc("events", "mixed-2", {
      name: "pricing_page_viewed",
      ts: now - 500,
      props: null,
    });

    const { loadAdminSubscriptionConversionFunnel } = await import("../admin/adminSubscriptionConversionView");
    const result = await loadAdminSubscriptionConversionFunnel({ days: 30 });

    expect(result.window.days).toBe(30);
    expect(result.funnel).toEqual([
      { step: "pricing_page_viewed", count: 1 },
      { step: "pricing_plan_cta_clicked", count: 1, conversionFromPrevious: 1 },
      { step: "upgrade_cta_clicked", count: 0, conversionFromPrevious: 0 },
      { step: "upgrade_prompt_viewed", count: 1, conversionFromPrevious: null },
      { step: "upgrade_prompt_checkout_clicked", count: 1, conversionFromPrevious: 1 },
      { step: "billing_page_opened", count: 0, conversionFromPrevious: 0 },
      { step: "billing_upgrade_clicked", count: 0, conversionFromPrevious: null },
    ]);
    expect(result.breakdowns).toEqual({
      targetPlan: { pro: 3 },
      surface: { pricing_page: 2, locked_feature: 2 },
      source: { marketing_pricing: 2, applications_page: 2 },
    });
    expect(queryLog[0]?.filters.map((item) => item.field)).toEqual(["ts", "ts"]);
  });

  it("returns safe empty output when no matching analytics events exist", async () => {
    const { loadAdminSubscriptionConversionFunnel } = await import("../admin/adminSubscriptionConversionView");
    const result = await loadAdminSubscriptionConversionFunnel({ days: 7 });

    expect(result.window.days).toBe(7);
    expect(result.funnel.every((step) => step.count === 0)).toBe(true);
    expect(result.breakdowns).toEqual({
      targetPlan: {},
      surface: {},
      source: {},
    });
  });

  it("filters out events outside the bounded time window", async () => {
    const now = Date.now();
    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;
    seedDoc("events", "old", {
      name: "pricing_page_viewed",
      ts: fortyDaysAgo,
      props: { surface: "pricing_page", source: "workspace_pricing" },
    });
    seedDoc("events", "recent", {
      name: "billing_page_opened",
      ts: now - 60_000,
      props: { surface: "billing_page", source: "billing_page" },
    });

    const { loadAdminSubscriptionConversionFunnel } = await import("../admin/adminSubscriptionConversionView");
    const result = await loadAdminSubscriptionConversionFunnel({ days: 30 });

    expect(result.funnel.find((step) => step.step === "pricing_page_viewed")?.count).toBe(0);
    expect(result.funnel.find((step) => step.step === "billing_page_opened")?.count).toBe(1);
  });
});
