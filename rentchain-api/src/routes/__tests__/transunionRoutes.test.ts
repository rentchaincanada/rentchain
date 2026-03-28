import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, resetDb, getDoc } = vi.hoisted(() => {
  const docs = new Map<string, any>();

  function normalize(path: string) {
    return path.replace(/^\/+|\/+$/g, "");
  }

  function setDoc(path: string, payload: any, merge?: boolean) {
    const key = normalize(path);
    if (merge && docs.has(key)) {
      docs.set(key, { ...(docs.get(key) || {}), ...(payload || {}) });
      return;
    }
    docs.set(key, payload || {});
  }

  function docRef(path: string) {
    const key = normalize(path);
    return {
      id: key.split("/").pop() || "",
      path: key,
      async get() {
        const data = docs.get(key);
        return {
          id: this.id,
          exists: docs.has(key),
          data: () => data,
        };
      },
      async set(payload: any, options?: { merge?: boolean }) {
        setDoc(key, payload, options?.merge);
      },
      collection(name: string) {
        return collectionRef(`${key}/${name}`);
      },
    };
  }

  function collectionRef(path: string) {
    const base = normalize(path);
    return {
      doc(id: string) {
        return docRef(`${base}/${id}`);
      },
    };
  }

  return {
    dbMock: {
      collection(name: string) {
        return collectionRef(name);
      },
    },
    resetDb: () => docs.clear(),
    getDoc: (path: string) => docs.get(normalize(path)) || null,
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, _res: any, next: any) => {
    req.user = { id: "user-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitSimple: () => (_req: any, _res: any, next: any) => next(),
}));

async function createApp() {
  const router = (await import("../../services/integrations/transunion/transunionRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/integrations", router);
  return app;
}

describe("transunionRoutes", () => {
  beforeEach(() => {
    resetDb();
    process.env.TRANSUNION_CREDENTIALS_ENCRYPTION_KEY = Buffer.from(
      "12345678901234567890123456789012"
    ).toString("base64");
  });

  it("transitions onboarding requests to pending_credentialing", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/integrations/transunion/onboarding-request")
      .send({ businessName: "North Wharf Holdings", contactEmail: "ops@example.com" });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("pending_credentialing");

    const stored = getDoc("landlords/landlord-1/integrations/transunion");
    expect(stored?.status).toBe("pending_credentialing");
    expect(stored?.provider).toBe("transunion");
  });

  it("connect saves encrypted values only", async () => {
    const app = await createApp();
    const res = await request(app)
      .post("/api/integrations/transunion/connect")
      .send({
        businessName: "North Wharf Holdings",
        contactName: "Avery Stone",
        contactEmail: "ops@example.com",
        memberCode: "MEMBER-7788",
        passcode: "PASS-1122",
        confirmPermissibleUse: true,
      });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("connected");
    expect(res.body?.memberCodeMasked).toBe("*******7788");
    expect(res.body?.passcode).toBeUndefined();

    const stored = getDoc("landlords/landlord-1/integrations/transunion");
    expect(stored?.memberCodeCiphertext).toBeTruthy();
    expect(stored?.passcodeCiphertext).toBeTruthy();
    expect(stored?.memberCodeCiphertext).not.toContain("MEMBER-7788");
    expect(stored?.passcodeCiphertext).not.toContain("PASS-1122");
    expect(stored?.memberCode).toBeUndefined();
    expect(stored?.passcode).toBeUndefined();
  });

  it("get returns safe public fields and never returns passcode", async () => {
    const app = await createApp();
    await request(app).post("/api/integrations/transunion/connect").send({
      businessName: "North Wharf Holdings",
      contactName: "Avery Stone",
      contactEmail: "ops@example.com",
      memberCode: "MEMBER-7788",
      passcode: "PASS-1122",
      confirmPermissibleUse: true,
    });

    const res = await request(app).get("/api/integrations/transunion");

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("connected");
    expect(res.body?.passcode).toBeUndefined();
    expect(res.body?.passcodeCiphertext).toBeUndefined();
    expect(res.body?.memberCodeMasked).toBe("*******7788");
  });

  it("disconnect wipes stored secrets", async () => {
    const app = await createApp();
    await request(app).post("/api/integrations/transunion/connect").send({
      businessName: "North Wharf Holdings",
      contactName: "Avery Stone",
      contactEmail: "ops@example.com",
      memberCode: "MEMBER-7788",
      passcode: "PASS-1122",
      confirmPermissibleUse: true,
    });

    const res = await request(app).post("/api/integrations/transunion/disconnect").send({});

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("disconnected");

    const stored = getDoc("landlords/landlord-1/integrations/transunion");
    expect(stored?.memberCodeCiphertext).toBeNull();
    expect(stored?.passcodeCiphertext).toBeNull();
    expect(stored?.memberCodeMasked).toBeNull();
  });
});
