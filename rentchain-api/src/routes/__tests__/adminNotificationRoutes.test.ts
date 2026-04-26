import { beforeEach, describe, expect, it, vi } from "vitest";

const loadNotificationStates = vi.fn();
const saveNotificationState = vi.fn();
const deriveNotifications = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: () => ({
      async get() {
        return { docs: [], empty: true, size: 0 };
      },
    }),
  },
}));

vi.mock("../../lib/notifications/loadNotifications", () => ({
  loadNotificationStates,
}));

vi.mock("../../lib/notifications/saveNotificationState", () => ({
  saveNotificationState,
}));

vi.mock("../../lib/notifications/deriveNotifications", () => ({
  deriveNotifications,
}));

vi.mock("../../lib/triage/deriveAdminTriageQueue", () => ({
  deriveAdminTriageQueue: () => [],
}));

vi.mock("../../lib/alerting/loadAlertStates", () => ({
  loadAlertStates: async () => [],
}));

vi.mock("../../lib/watchlist/loadWatchlistEntries", () => ({
  ADMIN_WATCHLISTS_COLLECTION: "adminWatchlists",
  loadWatchlistEntries: async () => [],
}));

vi.mock("../../lib/alerting/deriveAdminAlerts", () => ({
  deriveAdminAlerts: () => [],
}));

vi.mock("../../lib/portfolioScoreHistory/loadPortfolioScoreHistory", () => ({
  loadPortfolioScoreHistory: async () => [],
}));

vi.mock("../../lib/portfolioScoreHistory/derivePortfolioScoreTrend", () => ({
  derivePortfolioScoreTrend: (history: any[], portfolioId: string) => ({
    version: "v1",
    portfolioId,
    generatedAt: "2026-04-16T12:00:00.000Z",
    latest: null,
    previous: null,
    direction: "insufficient_data",
    deltaScore: null,
    deltaGrade: null,
    summary: { headline: "No history", notes: [] },
    movers: [],
    history,
  }),
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: any; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const paramsMatch = path.match(/\/notifications\/([^/]+)\/read$/);
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      query: Object.fromEntries(query.entries()),
      params: paramsMatch ? { notificationId: paramsMatch[1] } : {},
      body: options.body || {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      setHeader() {},
    };
    router.handle(req, res, (error: any) => (error ? reject(error) : undefined));
  });
}

describe("adminNotificationRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadNotificationStates.mockResolvedValue([]);
    deriveNotifications.mockReturnValue([]);
    saveNotificationState.mockResolvedValue({
      id: "notification-1",
      status: "read",
      readAt: "2026-04-16T12:00:00.000Z",
      updatedAt: "2026-04-16T12:00:00.000Z",
    });
  });

  it("returns stable empty states and enforces admin-only access", async () => {
    const router = (await import("../adminNotificationRoutes")).default;
    const empty = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      user: { id: "admin-1", role: "admin" },
    });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ notifications: [], nextCursor: undefined });

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/notifications",
      user: { id: "landlord-1", role: "landlord" },
    });
    expect(forbidden.status).toBe(403);
  });

  it("persists read state and supports watcher filtering passthrough", async () => {
    deriveNotifications.mockReturnValue([
      {
        version: "v1",
        id: "notification-1",
        type: "triage_item",
        resource: { type: "application", id: "app-1", portfolioId: "portfolio-1" },
        summary: { title: "Critical issue needs attention", message: "Screening reconciliation signals are inconsistent." },
        severity: "critical",
        watched: true,
        state: { status: "unread", readAt: null },
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
        navigation: {
          supportConsolePath: "/admin/support-console?resourceType=application&resourceId=app-1",
          triagePath: "/admin/triage?resourceType=application",
          portfolioScorePath: "/admin/portfolio-score?portfolioId=portfolio-1",
        },
      },
    ]);

    const router = (await import("../adminNotificationRoutes")).default;

    const fetched = await invokeRouter(router, {
      method: "GET",
      url: "/notifications?watchedOnly=true",
      user: { id: "admin-1", role: "admin" },
    });
    expect(fetched.status).toBe(200);
    expect(fetched.body?.notifications).toHaveLength(1);
    expect(fetched.body?.notifications[0]?.watched).toBe(true);

    const updated = await invokeRouter(router, {
      method: "PATCH",
      url: "/notifications/notification-1/read",
      user: { id: "admin-1", role: "admin" },
      body: { read: true },
    });
    expect(updated.status).toBe(200);
    expect(saveNotificationState).toHaveBeenCalledWith({
      notificationId: "notification-1",
      read: true,
    });
    expect(updated.body?.state?.status).toBe("read");
  });
});
