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

describe("adminActivationSummary", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("aggregates activation events, plan/surface breakdowns, and activation insights", async () => {
    const now = Date.now();
    seedDoc("events", "activation-1", {
      name: "activation_property_created",
      ts: now - 1_000,
      userId: "user-1",
      props: { plan: "free", surface: "properties_page", source: "add_property_form", route: "/properties" },
    });
    seedDoc("events", "activation-2", {
      name: "activation_unit_created",
      ts: now - 900,
      userId: "user-1",
      props: { plan: "free", surface: "properties_page", source: "manual_units_modal", route: "/properties" },
    });
    seedDoc("events", "activation-3", {
      name: "activation_tenant_added",
      ts: now - 800,
      sessionId: "session-2",
      props: { plan: "starter", surface: "tenant_invite_modal", source: "tenant_invite_modal", route: "/tenants" },
    });
    seedDoc("events", "non-activation-1", {
      name: "pricing_page_viewed",
      ts: now - 700,
      userId: "user-2",
      props: { surface: "marketing_pricing" },
    });
    seedDoc("events", "mixed-1", {
      type: "legacy_event",
      occurredAt: new Date(now - 600).toISOString(),
      payload: {},
    });

    const { loadAdminActivationSummary } = await import("../admin/adminActivationSummary");
    const result = await loadAdminActivationSummary({ days: 30 });

    expect(result.activationEvents).toEqual({
      property_created: 1,
      unit_created: 1,
      tenant_added: 1,
      work_order_created: 0,
    });
    expect(result.activatedUsers).toBe(2);
    expect(result.activationRateEstimate).toBeCloseTo(2 / 3);
    expect(result.breakdowns.byEventName).toEqual({
      activation_property_created: 1,
      activation_tenant_added: 1,
      activation_unit_created: 1,
    });
    expect(result.breakdowns.byPlan).toEqual({
      free: 2,
      starter: 1,
    });
    expect(result.breakdowns.bySurface).toEqual({
      properties_page: 2,
      tenant_invite_modal: 1,
    });
    expect(result.insights).toEqual({
      mostCommonActivationEvent: {
        eventName: "activation_property_created",
        count: 1,
      },
      planSeeingActivation: {
        plan: "free",
        count: 2,
      },
      activationOccurring: true,
    });
  });

  it("returns safe empty output when no activation events exist", async () => {
    const { loadAdminActivationSummary } = await import("../admin/adminActivationSummary");
    const result = await loadAdminActivationSummary({ days: 7 });

    expect(result.activationEvents).toEqual({
      property_created: 0,
      unit_created: 0,
      tenant_added: 0,
      work_order_created: 0,
    });
    expect(result.activatedUsers).toBe(0);
    expect(result.activationRateEstimate).toBeNull();
    expect(result.breakdowns).toEqual({
      byEventName: {},
      byPlan: {},
      bySurface: {},
    });
    expect(result.insights).toEqual({
      mostCommonActivationEvent: {
        eventName: null,
        count: 0,
      },
      planSeeingActivation: {
        plan: null,
        count: 0,
      },
      activationOccurring: false,
    });
  });
});
