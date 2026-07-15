import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, listDocs, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let idSeq = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const col = ensureCollection(name);
        const docs = Array.from(col.values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id?: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id?: string) {
    const actualId = id || `doc_${++idSeq}`;
    const col = ensureCollection(name);
    return {
      id: actualId,
      set: async (value: any, options?: { merge?: boolean }) => {
        const current = col.get(actualId)?.data || {};
        col.set(actualId, { id: actualId, data: options?.merge ? { ...current, ...value } : value });
      },
      get: async () => {
        const entry = col.get(actualId);
        return { id: actualId, exists: Boolean(entry), data: () => entry?.data };
      },
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
      idSeq = 0;
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    listDocs: (name: string) => Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, data: doc.data })),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../firebase", () => ({
  db: fakeDb,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (req.headers?.["x-no-auth"] === "1") {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    req.user ||= { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "ll@example.com" };
    next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const header = String(req.headers?.["x-test-user"] || "").trim();
    req.user = header
      ? JSON.parse(header)
      : req.user || { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "ll@example.com" };
    if (req.user.role !== "landlord" && req.user.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    req.user.landlordId = req.user.landlordId || req.user.id;
    next();
  },
}));

async function invokeRouter(router: any, options: {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  return await new Promise<{ status: number; body: any; headers: Record<string, any> }>((resolve, reject) => {
    const headers: Record<string, any> = {};
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      body: options.body ?? {},
      headers: options.headers ?? {},
      query: {},
      params: {},
    };
    const queryIndex = options.url.indexOf("?");
    if (queryIndex >= 0) {
      const query = new URLSearchParams(options.url.slice(queryIndex + 1));
      query.forEach((value, key) => {
        req.query[key] = value;
      });
      req.url = options.url.slice(0, queryIndex);
      req.path = req.url;
    }
    const res: any = {
      statusCode: 200,
      setHeader: (key: string, value: any) => {
        headers[key.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload, headers });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
      else resolve({ status: 404, body: { ok: false, error: "not_found" }, headers });
    });
  });
}

describe("landlordSchedulingDayNotesRoutes", () => {
  beforeEach(() => {
    resetFakeDb();
  });

  it("creates, updates, and reads landlord-scoped scheduling day notes", async () => {
    const router = (await import("../landlordSchedulingDayNotesRoutes")).default;

    const create = await invokeRouter(router, {
      method: "POST",
      url: "/scheduling/day-notes/2026-07-15",
      body: { noteText: "1pm viewing", source: "scheduling" },
    });

    expect(create.status).toBe(201);
    expect(create.body.note).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        date: "2026-07-15",
        noteText: "1pm viewing",
        source: "scheduling",
        status: "active",
        createdBy: "landlord-1",
        createdByEmail: "ll@example.com",
      })
    );

    const update = await invokeRouter(router, {
      method: "PATCH",
      url: `/scheduling/day-notes/2026-07-15/${create.body.note.noteId}`,
      body: { noteText: "3pm plumber", source: "dashboard" },
    });
    expect(update.status).toBe(200);
    expect(update.body.note.noteText).toBe("3pm plumber");
    expect(update.body.note.source).toBe("dashboard");

    const single = await invokeRouter(router, { method: "GET", url: "/scheduling/day-notes/2026-07-15" });
    expect(single.status).toBe(200);
    expect(single.body.notes).toEqual([expect.objectContaining({ noteText: "3pm plumber" })]);
  });

  it("reads an active date range grouped by date", async () => {
    seedDoc("schedulingDayNotes", "note-1", {
      noteId: "note-1",
      landlordId: "landlord-1",
      date: "2026-07-15",
      noteText: "1pm viewing",
      status: "active",
      source: "scheduling",
      createdAt: "2026-07-15T12:00:00.000Z",
      updatedAt: "2026-07-15T12:00:00.000Z",
    });
    seedDoc("schedulingDayNotes", "note-2", {
      noteId: "note-2",
      landlordId: "landlord-1",
      date: "2026-07-16",
      noteText: "Call contractor",
      status: "active",
      source: "scheduling",
      createdAt: "2026-07-16T12:00:00.000Z",
      updatedAt: "2026-07-16T12:00:00.000Z",
    });
    seedDoc("schedulingDayNotes", "note-deleted", {
      noteId: "note-deleted",
      landlordId: "landlord-1",
      date: "2026-07-15",
      noteText: "Deleted note",
      status: "deleted",
      source: "scheduling",
    });
    const router = (await import("../landlordSchedulingDayNotesRoutes")).default;

    const range = await invokeRouter(router, {
      method: "GET",
      url: "/scheduling/day-notes?startDate=2026-07-15&endDate=2026-07-16",
    });

    expect(range.status).toBe(200);
    expect(range.body.notes).toHaveLength(2);
    expect(range.body.notesByDate).toEqual({
      "2026-07-15": [expect.objectContaining({ noteText: "1pm viewing" })],
      "2026-07-16": [expect.objectContaining({ noteText: "Call contractor" })],
    });
  });

  it("soft-deletes notes and excludes them from future reads", async () => {
    const router = (await import("../landlordSchedulingDayNotesRoutes")).default;
    const create = await invokeRouter(router, {
      method: "POST",
      url: "/scheduling/day-notes/2026-07-15",
      body: { noteText: "Delete this note" },
    });

    const deleted = await invokeRouter(router, {
      method: "DELETE",
      url: `/scheduling/day-notes/2026-07-15/${create.body.note.noteId}`,
    });

    expect(deleted.status).toBe(200);
    expect(deleted.body.note.status).toBe("deleted");
    expect(listDocs("schedulingDayNotes")[0].data.status).toBe("deleted");

    const single = await invokeRouter(router, { method: "GET", url: "/scheduling/day-notes/2026-07-15" });
    expect(single.status).toBe(200);
    expect(single.body.notes).toEqual([]);
  });

  it("blocks cross-landlord reads and note mutations", async () => {
    const router = (await import("../landlordSchedulingDayNotesRoutes")).default;
    const create = await invokeRouter(router, {
      method: "POST",
      url: "/scheduling/day-notes/2026-07-15",
      body: { noteText: "Landlord one note" },
    });
    const otherUser = JSON.stringify({ id: "landlord-2", landlordId: "landlord-2", role: "landlord", email: "other@example.com" });

    const otherRead = await invokeRouter(router, {
      method: "GET",
      url: "/scheduling/day-notes/2026-07-15",
      headers: { "x-test-user": otherUser },
    });
    expect(otherRead.status).toBe(200);
    expect(otherRead.body.notes).toEqual([]);

    const otherUpdate = await invokeRouter(router, {
      method: "PATCH",
      url: `/scheduling/day-notes/2026-07-15/${create.body.note.noteId}`,
      body: { noteText: "Should not update" },
      headers: { "x-test-user": otherUser },
    });
    expect(otherUpdate.status).toBe(404);
    expect(otherUpdate.body.code).toBe("SCHEDULING_DAY_NOTE_NOT_FOUND");
  });

  it("rejects unauthenticated, non-landlord, invalid-date, and overlong requests", async () => {
    const router = (await import("../landlordSchedulingDayNotesRoutes")).default;

    const unauth = await invokeRouter(router, {
      method: "GET",
      url: "/scheduling/day-notes/2026-07-15",
      headers: { "x-no-auth": "1" },
    });
    expect(unauth.status).toBe(401);

    const tenant = await invokeRouter(router, {
      method: "GET",
      url: "/scheduling/day-notes/2026-07-15",
      headers: { "x-test-user": JSON.stringify({ id: "tenant-1", role: "tenant", email: "tenant@example.com" }) },
    });
    expect(tenant.status).toBe(403);

    const invalidDate = await invokeRouter(router, {
      method: "POST",
      url: "/scheduling/day-notes/not-a-date",
      body: { noteText: "Invalid date" },
    });
    expect(invalidDate.status).toBe(400);
    expect(invalidDate.body.code).toBe("SCHEDULING_DAY_NOTE_INVALID_DATE");

    const tooLong = await invokeRouter(router, {
      method: "POST",
      url: "/scheduling/day-notes/2026-07-15",
      body: { noteText: "x".repeat(2001) },
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.code).toBe("SCHEDULING_DAY_NOTE_TEXT_TOO_LONG");
  });
});
