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
        doc: (id: string) => ({
          get: async () => {
            const row = ensureCollection(name).get(id);
            return {
              exists: Boolean(row),
              data: () => row?.data || undefined,
            };
          },
        }),
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

describe("adminSubscriptionConversionValidation", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("classifies allowlisted internal accounts explicitly before falling back to heuristics", async () => {
    const now = Date.now();
    seedDoc("events", "real-1", {
      name: "pricing_page_viewed",
      ts: now - 4_000,
      sessionId: "sess-real-1",
      props: { surface: "marketing_pricing", source: "marketing_pricing" },
    });
    seedDoc("events", "real-2", {
      name: "pricing_plan_cta_clicked",
      ts: now - 3_000,
      sessionId: "sess-real-1",
      props: { targetPlan: "starter", surface: "marketing_pricing", source: "marketing_pricing" },
    });
    seedDoc("events", "real-3", {
      name: "billing_page_opened",
      ts: now - 2_000,
      sessionId: "sess-real-1",
      props: { surface: "billing_page", source: "billing_page" },
    });
    seedDoc("events", "real-4", {
      name: "billing_upgrade_clicked",
      ts: now - 1_000,
      sessionId: "sess-real-1",
      props: { targetPlan: "starter", surface: "billing_page", source: "billing_page" },
    });

    seedDoc("events", "test-1", {
      name: "pricing_page_viewed",
      ts: now - 900,
      userId: "tester-1",
      props: { surface: "workspace_pricing", source: "workspace_pricing" },
    });
    seedDoc("events", "test-2", {
      name: "pricing_plan_cta_clicked",
      ts: now - 800,
      userId: "tester-1",
      props: { targetPlan: "starter", surface: "workspace_pricing", source: "workspace_pricing" },
    });
    seedDoc("events", "test-3", {
      name: "pricing_plan_cta_clicked",
      ts: now - 700,
      userId: "tester-1",
      props: { targetPlan: "pro", surface: "workspace_pricing", source: "workspace_pricing" },
    });
    seedDoc("events", "test-4", {
      name: "billing_page_opened",
      ts: now - 600,
      userId: "tester-1",
      props: { surface: "billing_page", source: "billing_page" },
    });
    seedDoc("events", "test-5", {
      name: "billing_upgrade_clicked",
      ts: now - 500,
      userId: "tester-1",
      props: { targetPlan: "pro", surface: "billing_page", source: "billing_page" },
    });
    seedDoc("events", "test-6", {
      name: "upgrade_cta_clicked",
      ts: now - 400,
      userId: "tester-1",
      props: { targetPlan: "elite", surface: "locked_feature", source: "applications_page" },
    });
    seedDoc("events", "test-7", {
      name: "upgrade_prompt_viewed",
      ts: now - 300,
      userId: "tester-1",
      props: {
        targetPlan: "elite",
        surface: "locked_feature",
        source: "applications_page",
        featureKey: "tenant_invites",
      },
    });
    seedDoc("events", "test-8", {
      name: "upgrade_prompt_checkout_clicked",
      ts: now - 200,
      userId: "tester-1",
      props: { targetPlan: "elite", surface: "locked_feature", source: "applications_page" },
    });
    seedDoc("events", "mixed-1", {
      type: "application_submitted",
      occurredAt: new Date(now - 100).toISOString(),
      payload: {},
    });
    seedDoc("users", "tester-1", {
      email: "admin+pro@rentchain.ai",
    });

    const { loadAdminSubscriptionConversionValidation } = await import(
      "../admin/adminSubscriptionConversionValidation"
    );
    const result = await loadAdminSubscriptionConversionValidation({ days: 30 });

    expect(result.segmentation.strategy).toBe("internal_allowlist_plus_heuristics_v1");
    expect(result.segments.all_activity.eventCount).toBe(12);
    expect(result.segments.likely_external_or_real.eventCount).toBe(4);
    expect(result.segments.likely_external_or_real.actorCount).toBe(1);
    expect(result.segments.likely_external_or_real.insights.strongestSurface).toEqual({
      surface: "billing_page",
      count: 1,
    });
    expect(result.segments.likely_internal_or_test.eventCount).toBe(8);
    expect(result.segments.likely_internal_or_test.actorCount).toBe(1);
    expect(result.segments.likely_internal_or_test.breakdowns.featureKey).toEqual({
      tenant_invites: 1,
    });
    expect(result.comparisons.dominantSegment).toEqual({
      segment: "likely_internal_or_test",
      eventCount: 8,
    });
    expect(result.recommendations).toContain(
      "Current funnel activity is dominated by likely internal or controlled testing traffic."
    );
    expect(result.recommendations).toContain(
      "Billing remains the strongest surface across both all activity and likely external activity."
    );
    expect(result.recommendations).toContain(
      "Prompt usage remains negligible outside likely internal or testing activity."
    );
    expect(result.segmentation.caveats).toHaveLength(4);
    expect(result.segmentation.caveats[0]).toContain("allowlist");
  });

  it("falls back to account email lookup when the users document does not exist", async () => {
    const now = Date.now();
    seedDoc("events", "test-1", {
      name: "pricing_page_viewed",
      ts: now - 500,
      userId: "tester-2",
      props: { surface: "workspace_pricing", source: "workspace_pricing" },
    });
    seedDoc("accounts", "tester-2", {
      email: "admin+elite@rentchain.ai",
    });

    const { loadAdminSubscriptionConversionValidation } = await import(
      "../admin/adminSubscriptionConversionValidation"
    );
    const result = await loadAdminSubscriptionConversionValidation({ days: 30 });

    expect(result.segments.likely_internal_or_test.eventCount).toBe(1);
    expect(result.segments.likely_external_or_real.eventCount).toBe(0);
  });

  it("returns safe empty segment output when no matching analytics events exist", async () => {
    const { loadAdminSubscriptionConversionValidation } = await import(
      "../admin/adminSubscriptionConversionValidation"
    );
    const result = await loadAdminSubscriptionConversionValidation({ days: 7 });

    expect(result.segments.all_activity.eventCount).toBe(0);
    expect(result.segments.likely_internal_or_test.eventCount).toBe(0);
    expect(result.segments.likely_external_or_real.eventCount).toBe(0);
    expect(result.comparisons.dominantSegment).toBeNull();
    expect(result.recommendations).toEqual([
      "Prompt usage remains negligible outside likely internal or testing activity.",
    ]);
  });
});
