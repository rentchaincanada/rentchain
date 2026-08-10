import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
const collections = new Map<string, Map<string, any>>();
const queryLimits: Array<{ collection: string; field: string; limit: number }> = [];
let transactionTail = Promise.resolve();

function collection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function clone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)); }

function docRef(name: string, id: string) {
  return {
    id,
    get: async () => ({ id, exists: collection(name).has(id), data: () => clone(collection(name).get(id)) }),
    set: async (value: any, options?: any) => {
      const current = collection(name).get(id) || {};
      collection(name).set(id, options?.merge ? { ...current, ...clone(value) } : clone(value));
    },
  };
}

const dbMock = {
  runTransaction: async (handler: any) => {
    const result = transactionTail.then(() => handler({
      get: (ref: any) => ref.get(),
      set: (ref: any, value: any, options?: any) => ref.set(value, options),
    }));
    transactionTail = result.then(() => undefined, () => undefined);
    return result;
  },
  collection: (name: string) => ({
    doc: (id: string) => docRef(name, id),
    where: (field: string, _op: string, value: any) => ({
      limit: (limit: number) => ({ get: async () => {
        queryLimits.push({ collection: name, field, limit });
        return { docs: Array.from(collection(name).entries()).filter(([, raw]) => raw?.[field] === value).slice(0, limit).map(([id, raw]) => ({ id, data: () => clone(raw) })) };
      } }),
    }),
  }),
};

vi.mock("../../firebase", () => ({ db: dbMock, FieldValue: { serverTimestamp: () => "__server_timestamp__" } }));
vi.mock("../../middleware/authMiddleware", () => ({ authenticateJwt: (req: any, _res: any, next: any) => { const raw = String(req.headers["x-test-user"] || ""); if (raw) req.user = JSON.parse(raw); next(); } }));
vi.mock("../../middleware/requireLandlord", () => ({ requireLandlord: (req: any, res: any, next: any) => req.user ? next() : res.status(401).json({ ok: false }) }));
vi.mock("../../services/emailService", () => ({ sendEmail: sendEmailMock }));
vi.mock("../../email/templates/baseEmailTemplate", () => ({ buildEmailText: vi.fn(() => "notice"), buildEmailHtml: vi.fn(() => "<p>notice</p>") }));

async function invoke(options: { method: string; url: string; body?: any; user?: any }) {
  const router = (await import("../propertyNoticesRoutes")).default;
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const parsed = new URL(options.url, "http://localhost");
    const req: any = { method: options.method, url: options.url, originalUrl: options.url, query: Object.fromEntries(parsed.searchParams), headers: options.user ? { "x-test-user": JSON.stringify(options.user) } : {}, body: options.body || {} };
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: any) { resolve({ status: this.statusCode, body }); return this; } };
    router.handle(req, res, (error: any) => error ? reject(error) : resolve({ status: 404, body: null }));
  });
}

const landlord = { id: "landlord-1", role: "landlord" };

function seed() {
  collection("properties").set("property-1", { landlordId: "landlord-1", name: "Harbour House", status: "active" });
  collection("properties").set("foreign-property", { landlordId: "landlord-2", name: "Foreign" });
  collection("units").set("unit-1", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "1A" });
  collection("units").set("unit-2", { landlordId: "landlord-1", propertyId: "property-1", unitNumber: "2B" });
  collection("tenants").set("tenant-1", { landlordId: "landlord-1", fullName: "Alex Current", email: "alex@example.test" });
  collection("tenants").set("tenant-2", { landlordId: "landlord-1", fullName: "Blair Missing" });
  collection("tenants").set("tenant-ended", { landlordId: "landlord-1", fullName: "Former Tenant", email: "former@example.test" });
  collection("tenants").set("tenant-foreign", { landlordId: "landlord-2", fullName: "Foreign Tenant", email: "foreign@example.test" });
  collection("leases").set("lease-1", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantIds: ["tenant-1", "tenant-2"], status: "active" });
  collection("leases").set("lease-duplicate", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-2", tenantId: "tenant-1", status: "active" });
  collection("leases").set("lease-ended", { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-2", tenantId: "tenant-ended", status: "ended" });
  collection("leases").set("lease-foreign", { landlordId: "landlord-2", propertyId: "property-1", unitId: "unit-2", tenantId: "tenant-ended", status: "active" });
  collection("leases").set("lease-foreign-tenant", { landlordId: "landlord-2", propertyId: "property-1", unitId: "unit-2", tenantId: "tenant-foreign", status: "active" });
}

describe("propertyNoticesRoutes", () => {
  beforeEach(() => {
    collections.clear(); queryLimits.length = 0; transactionTail = Promise.resolve(); sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ provider: "mailgun", providerMessageId: "provider-safe", providerResponseId: "provider-safe" });
    process.env.EMAIL_FROM = "notices@example.test";
    seed();
  });

  it("previews only current owned-property recipients with deterministic dedupe and bounded reads", async () => {
    const response = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1", user: landlord });
    expect(response.status).toBe(200);
    expect(response.body.recipients).toHaveLength(2);
    expect(response.body.recipients.map((item: any) => item.tenantDisplayName)).toEqual(["Alex Current", "Blair Missing"]);
    expect(response.body.recipients[0].unitLabels).toEqual(["1A", "2B"]);
    expect(response.body.recipients[1].deliveryAvailability).toBe("missing_email");
    expect(JSON.stringify(response.body)).not.toContain("former@example.test");
    expect(queryLimits).toContainEqual({ collection: "leases", field: "propertyId", limit: 101 });
  });

  it("rejects foreign property and caller-supplied authority fields", async () => {
    const foreign = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=foreign-property", user: landlord });
    expect(foreign.status).toBe(403);
    const supplied = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: { landlordId: "landlord-2", propertyId: "property-1", subject: "Test", body: "Body", idempotencyKey: "request_1234567890" } });
    expect(supplied.status).toBe(400);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    ["ended", "tenant-ended"],
    ["foreign", "tenant-foreign"],
    ["unknown", "tenant-unknown"],
    ["malformed", "tenant/unsafe"],
    ["empty", ""],
    ["mixed ended", "tenant-1,tenant-ended"],
    ["mixed foreign", "tenant-1,tenant-foreign"],
    ["mixed unknown", "tenant-1,tenant-unknown"],
  ])("rejects an explicit %s tenant preview filter without partial results", async (_label, tenantIds) => {
    const response = await invoke({
      method: "GET",
      url: `/landlord/notices/recipients?propertyId=property-1&tenantIds=${encodeURIComponent(tenantIds)}`,
      user: landlord,
    });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ ok: false, code: "notice_recipient_not_eligible", error: "Notice recipients unavailable" });
  });

  it("preserves valid subsets, unit-scoped validation, dedupe, missing destination, and duplicate normalization", async () => {
    const one = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&tenantIds=tenant-1", user: landlord });
    expect(one.status).toBe(200);
    expect(one.body.recipients.map((item: any) => item.tenantId)).toEqual(["tenant-1"]);
    expect(one.body.recipients[0].unitLabels).toEqual(["1A", "2B"]);

    const multiple = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&tenantIds=tenant-1,tenant-2", user: landlord });
    expect(multiple.status).toBe(200);
    expect(multiple.body.recipients.map((item: any) => item.tenantId)).toEqual(["tenant-1", "tenant-2"]);
    expect(multiple.body.recipients[1].deliveryAvailability).toBe("missing_email");

    const duplicate = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&tenantIds=tenant-1,tenant-1", user: landlord });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.recipients).toHaveLength(1);

    const unitValid = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&unitIds=unit-1&tenantIds=tenant-1", user: landlord });
    expect(unitValid.status).toBe(200);
    expect(unitValid.body.recipients[0].unitLabels).toEqual(["1A"]);

    const outsideUnit = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&unitIds=unit-2&tenantIds=tenant-2", user: landlord });
    expect(outsideUnit.status).toBe(403);
    expect(outsideUnit.body.code).toBe("notice_recipient_not_eligible");

    const multipleUnits = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&unitIds=unit-1,unit-2&tenantIds=tenant-1,tenant-2", user: landlord });
    expect(multipleUnits.status).toBe(200);
    expect(multipleUnits.body.recipients).toHaveLength(2);

    const emptyUnit = await invoke({ method: "GET", url: "/landlord/notices/recipients?propertyId=property-1&unitIds=unit-unknown", user: landlord });
    expect(emptyUnit.status).toBe(200);
    expect(emptyUnit.body.recipients).toEqual([]);
  });

  it.each(["tenant-ended", "tenant-foreign", "tenant-unknown"])(
    "rejects unit-scoped explicit ineligible tenant %s",
    async (tenantId) => {
      const response = await invoke({
        method: "GET",
        url: `/landlord/notices/recipients?propertyId=property-1&unitIds=unit-1&tenantIds=${tenantId}`,
        user: landlord,
      });
      expect(response.status).toBe(403);
      expect(response.body.code).toBe("notice_recipient_not_eligible");
    }
  );

  it.each([
    ["ended", ["tenant-ended"]],
    ["foreign", ["tenant-foreign"]],
    ["unknown", ["tenant-unknown"]],
    ["malformed", ["tenant/unsafe"]],
    ["empty", []],
    ["mixed invalid", ["tenant-1", "tenant-unknown"]],
  ])("rejects an explicit %s create filter before persistence or provider/network invocation", async (_label, selectedTenantIds) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await invoke({
      method: "POST",
      url: "/landlord/notices",
      user: landlord,
      body: {
        propertyId: "property-1",
        subject: "Synthetic rejection",
        body: "No delivery is authorized.",
        idempotencyKey: "request_reject_12345",
        selectedTenantIds,
      },
    });
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ ok: false, code: "notice_recipient_not_eligible", error: "Notice recipients unavailable" });
    expect(collection("propertyNotices")).toHaveLength(0);
    expect(collection("propertyNoticeDeliveries")).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a non-array explicit create filter before persistence or provider invocation", async () => {
    const response = await invoke({
      method: "POST",
      url: "/landlord/notices",
      user: landlord,
      body: {
        propertyId: "property-1",
        subject: "Synthetic rejection",
        body: "No delivery is authorized.",
        idempotencyKey: "request_reject_67890",
        selectedTenantIds: "tenant-1",
      },
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("notice_recipient_not_eligible");
    expect(collection("propertyNotices")).toHaveLength(0);
    expect(collection("propertyNoticeDeliveries")).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("fails before delivery when the bounded lease or recipient cap is exceeded", async () => {
    for (let index = 0; index < 101; index += 1) {
      collection("leases").set(`cap-lease-${index}`, { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: `cap-tenant-${index}`, status: "active" });
    }
    const response = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: { propertyId: "property-1", subject: "Bounded", body: "Bounded notice.", idempotencyKey: "request_cap_123456" } });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ ok: false, error: "Recipient limit exceeded", maxRecipients: 100 });
    expect(collection("propertyNotices")).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("creates one private delivery per deduped recipient and is idempotent", async () => {
    const request = { propertyId: "property-1", subject: "Water shutdown", body: "Water is off at noon.", idempotencyKey: "request_1234567890" };
    const first = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: request });
    const second = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: request });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(collection("propertyNotices")).toHaveLength(1);
    expect(collection("propertyNoticeDeliveries")).toHaveLength(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe("alex@example.test");
    expect(sendEmailMock.mock.calls[0][0].cc).toBeUndefined();
    expect(sendEmailMock.mock.calls[0][0].bcc).toBeUndefined();
    expect(first.body.notice.status).toBe("partially_failed");
    expect(first.body.notice.skippedCount).toBe(1);
  });

  it("serializes concurrent requests for one idempotency key without duplicate delivery", async () => {
    const request = { propertyId: "property-1", subject: "Concurrent", body: "Synthetic concurrency check.", idempotencyKey: "request_concurrent_123" };
    const [first, second] = await Promise.all([
      invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: request }),
      invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: request }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(collection("propertyNotices")).toHaveLength(1);
    expect(collection("propertyNoticeDeliveries")).toHaveLength(2);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("records normalized partial failure without exposing the provider error", async () => {
    collection("tenants").get("tenant-2").email = "blair@example.test";
    sendEmailMock.mockResolvedValueOnce({ provider: "mailgun", providerMessageId: "one", providerResponseId: "one" }).mockRejectedValueOnce(new Error("mailgun_send_failed:503 secret-response"));
    const response = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: { propertyId: "property-1", subject: "Elevator", body: "Elevator service window.", idempotencyKey: "request_abcdefghijk" } });
    expect(response.status).toBe(201);
    expect(response.body.notice.status).toBe("partially_failed");
    expect(response.body.notice.sentCount).toBe(1);
    expect(response.body.notice.failedCount).toBe(1);
    const failed = Array.from(collection("propertyNoticeDeliveries").values()).find((item) => item.status === "failed");
    expect(failed.errorCategory).toBe("provider_rejected");
    expect(JSON.stringify(failed)).not.toContain("secret-response");
  });

  it("keeps history and detail landlord scoped with recipient snapshots", async () => {
    const sent = await invoke({ method: "POST", url: "/landlord/notices", user: landlord, body: { propertyId: "property-1", subject: "Parking", body: "Parking closure.", idempotencyKey: "request_history_123" } });
    const id = sent.body.notice.id;
    collection("tenants").delete("tenant-1");
    const history = await invoke({ method: "GET", url: "/landlord/notices", user: landlord });
    const detail = await invoke({ method: "GET", url: `/landlord/notices/${id}`, user: landlord });
    const foreign = await invoke({ method: "GET", url: `/landlord/notices/${id}`, user: { id: "landlord-2", role: "landlord" } });
    expect(history.body.notices).toHaveLength(1);
    expect(detail.body.deliveries[0].tenantDisplayName).toBe("Alex Current");
    expect(detail.body.deliveries[0].destination).toBeUndefined();
    expect(foreign.status).toBe(403);
  });
});
