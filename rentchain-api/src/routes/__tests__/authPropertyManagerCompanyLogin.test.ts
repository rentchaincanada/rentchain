import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = Record<string, any>;

const collections = vi.hoisted(() => new Map<string, Map<string, StoredDoc>>());
const reads = vi.hoisted(() => new Map<string, number>());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

const fakeDb = vi.hoisted(() => ({
  collection(name: string) {
    const collection = ensureCollection(name);
    return {
      doc(id?: string) {
        const docId = id || `doc_${collection.size + 1}`;
        return {
          id: docId,
          async get() {
            const key = `${name}/${docId}`;
            reads.set(key, (reads.get(key) || 0) + 1);
            return {
              id: docId,
              exists: collection.has(docId),
              data: () => copy(collection.get(docId)),
            };
          },
          async set(data: StoredDoc, opts?: { merge?: boolean }) {
            const current = collection.get(docId) || {};
            collection.set(docId, opts?.merge ? { ...current, ...copy(data) } : copy(data));
          },
        };
      },
      where(field: string, op: string, value: unknown) {
        return {
          limit: (_count: number) => ({
            async get() {
              const key = `${name}:query:${field}`;
              reads.set(key, (reads.get(key) || 0) + 1);
              const docs = Array.from(collection.entries())
                .filter(([, data]) => (op === "==" ? data?.[field] === value : false))
                .map(([id, data]) => ({ id, exists: true, data: () => copy(data) }));
              return { docs, empty: docs.length === 0 };
            },
          }),
        };
      },
      async get() {
        return {
          docs: Array.from(collection.entries()).map(([id, data]) => ({
            id,
            exists: true,
            data: () => copy(data),
          })),
        };
      },
    };
  },
}));

vi.mock("../../firebase", () => ({
  db: fakeDb,
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
    arrayUnion: (...values: any[]) => values,
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({
      getUser: getUserMock,
    }),
    firestore: {
      FieldValue: {
        serverTimestamp: () => "__server_timestamp__",
      },
    },
  },
}));

vi.mock("../../services/authService", async () => {
  const actual = await vi.importActual<any>("../../services/authService");
  return {
    ...actual,
    signInWithPassword: signInWithPasswordMock,
    generateJwtForLandlord: vi.fn(() => "demo-token"),
  };
});

vi.mock("../../services/emailService", () => ({
  sendEmail: vi.fn(),
  sendLandlordWelcomeEmail: vi.fn(),
}));

vi.mock("../../services/microLiveGrant", () => ({
  maybeGrantMicroLiveFromLead: vi.fn(),
}));

function writeDoc(collectionName: string, id: string, data: StoredDoc) {
  ensureCollection(collectionName).set(id, copy(data));
}

function readDoc(collectionName: string, id: string) {
  return ensureCollection(collectionName).get(id);
}

function collectionSize(collectionName: string) {
  return ensureCollection(collectionName).size;
}

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    body?: Record<string, unknown>;
    token?: string;
  }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      body: options.body || {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

function seedAuthUser(uid: string, email: string) {
  signInWithPasswordMock.mockResolvedValue({ uid, email });
  getUserMock.mockResolvedValue({ uid, email, emailVerified: true });
}

function seedProfile(uid: string, email: string, role: string, extra: StoredDoc = {}) {
  const profile = {
    id: uid,
    email,
    role,
    accountType: role,
    landlordId: role === "landlord" ? uid : null,
    approved: true,
    status: "active",
    permissions: [],
    revokedPermissions: [],
    ...extra,
  };
  writeDoc("users", uid, profile);
  writeDoc("accounts", uid, profile);
}

describe("auth login property manager company profiles", () => {
  beforeEach(() => {
    collections.clear();
    reads.clear();
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    process.env.FIREBASE_API_KEY = "test-firebase-key";
    process.env.AUTH_HYDRATE_FROM_DB = "true";
    process.env.PASSWORD_LOGIN_ENABLED = "true";
  });

  it("logs in a PM company admin without creating a landlord profile", async () => {
    seedAuthUser("pm-admin-user-1", "admin+propertymanager@rentchain.ai");
    seedProfile("pm-admin-user-1", "admin+propertymanager@rentchain.ai", "property_manager_company");
    writeDoc("propertyManagerCompanies", "pm-company-1", {
      companyId: "pm-company-1",
      companyName: "Acme Property Management QA",
      safeDisplayLabel: "Acme Property Management QA",
      status: "active",
      createdByUserId: "pm-admin-user-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    });
    writeDoc("propertyManagerCompanyMemberships", "pm-membership-1", {
      membershipId: "pm-membership-1",
      companyId: "pm-company-1",
      userId: "pm-admin-user-1",
      role: "company_admin",
      status: "active",
      safeDisplayLabel: "admin+propertymanager@rentchain.ai",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
      suspendedAt: null,
      removedAt: null,
    });

    const authRouter = (await import("../authRoutes")).default;
    const login = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "admin+propertymanager@rentchain.ai", password: "secretpass" },
    });

    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({
      id: "pm-admin-user-1",
      email: "admin+propertymanager@rentchain.ai",
      role: "property_manager_company",
      actorRole: "property_manager_company",
      landlordId: null,
      approved: true,
    });
    expect(collectionSize("landlords")).toBe(0);
    expect(reads.get("landlords/pm-admin-user-1") || 0).toBe(0);
    expect(reads.get("landlords:query:email") || 0).toBe(0);

    const { propertyManagerCompanyRoutes } = await import("../propertyManagerCompanyRelationshipRoutes");
    const companyContext = await invokeRouter(propertyManagerCompanyRoutes, {
      method: "GET",
      url: "/my-companies",
      token: login.body.token,
    });

    expect(companyContext.status).toBe(200);
    expect(companyContext.body.companies).toEqual([
      expect.objectContaining({
        companyLabel: "Acme Property Management QA",
        role: "company_admin",
        status: "active",
      }),
    ]);
  });

  it("denies PM company users landlord-owner routes", async () => {
    seedAuthUser("pm-admin-user-1", "admin+propertymanager@rentchain.ai");
    seedProfile("pm-admin-user-1", "admin+propertymanager@rentchain.ai", "property_manager_company");

    const authRouter = (await import("../authRoutes")).default;
    const login = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "admin+propertymanager@rentchain.ai", password: "secretpass" },
    });
    const landlordRouter = (await import("../propertyManagerCompanyRelationshipRoutes")).default;
    const landlordResponse = await invokeRouter(landlordRouter, {
      method: "GET",
      url: "/property-manager-company-relationships",
      token: login.body.token,
    });

    expect(landlordResponse.status).toBe(403);
    expect(landlordResponse.body.error).toBe("FORBIDDEN");
  });

  it("fails closed when a PM company profile includes landlord scope", async () => {
    seedAuthUser("pm-admin-user-1", "admin+propertymanager@rentchain.ai");
    seedProfile("pm-admin-user-1", "admin+propertymanager@rentchain.ai", "property_manager_company", {
      landlordId: "landlord-scope-1",
    });

    const authRouter = (await import("../authRoutes")).default;
    const response = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "admin+propertymanager@rentchain.ai", password: "secretpass" },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("UNSUPPORTED_ACCOUNT_ROLE");
    expect(collectionSize("landlords")).toBe(0);
    expect(reads.get("landlords/pm-admin-user-1") || 0).toBe(0);
    expect(reads.get("landlords:query:email") || 0).toBe(0);
  });

  it("keeps existing landlord login behavior", async () => {
    seedAuthUser("landlord-user-1", "owner@example.com");

    const authRouter = (await import("../authRoutes")).default;
    const response = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "owner@example.com", password: "secretpass" },
    });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("landlord");
    expect(readDoc("landlords", "landlord-user-1")).toMatchObject({
      id: "landlord-user-1",
      landlordId: "landlord-user-1",
      email: "owner@example.com",
      role: "landlord",
    });
  });

  it("keeps existing delegate and contractor login branches safe", async () => {
    const authRouter = (await import("../authRoutes")).default;

    seedAuthUser("delegate-user-1", "delegate@example.com");
    seedProfile("delegate-user-1", "delegate@example.com", "delegate");
    const delegate = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "delegate@example.com", password: "secretpass" },
    });
    expect(delegate.status).toBe(200);
    expect(delegate.body.user).toMatchObject({ role: "delegate", landlordId: null });

    seedAuthUser("contractor-user-1", "contractor@example.com");
    seedProfile("contractor-user-1", "contractor@example.com", "contractor", {
      contractorId: "contractor-user-1",
    });
    const contractor = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "contractor@example.com", password: "secretpass" },
    });
    expect(contractor.status).toBe(200);
    expect(contractor.body.user).toMatchObject({ role: "contractor", contractorId: "contractor-user-1" });
    expect(collectionSize("landlords")).toBe(0);
  });

  it("fails closed for malformed persisted roles", async () => {
    seedAuthUser("bad-user-1", "bad@example.com");
    seedProfile("bad-user-1", "bad@example.com", "mystery_role");

    const authRouter = (await import("../authRoutes")).default;
    const response = await invokeRouter(authRouter, {
      method: "POST",
      url: "/login",
      body: { email: "bad@example.com", password: "secretpass" },
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("UNSUPPORTED_ACCOUNT_ROLE");
    expect(collectionSize("landlords")).toBe(0);
  });
});
