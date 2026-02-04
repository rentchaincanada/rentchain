import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

const createUserMock = vi.fn(async () => ({ uid: "user-123" }));
const accountsSetMock = vi.fn(async () => ({}));
const landlordsSetMock = vi.fn(async () => ({}));
const onboardingSetMock = vi.fn(async () => ({}));

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({ createUser: createUserMock }),
    firestore: {
      FieldValue: { serverTimestamp: vi.fn(() => "ts") },
    },
  },
}));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: (name: string) => {
      if (name === "accounts") {
        return { doc: () => ({ set: accountsSetMock }) };
      }
      if (name === "landlords") {
        return {
          doc: () => ({
            set: landlordsSetMock,
            collection: () => ({
              doc: () => ({ set: onboardingSetMock }),
            }),
          }),
        };
      }
      return { doc: () => ({ set: vi.fn() }) };
    },
  },
}));

vi.mock("../../middleware/requireAdmin", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

describe("admin create landlord", () => {
  it("creates auth user and writes landlord docs", async () => {
    const router = (await import("../adminRoutes")).default;
    const app = express();
    app.use(express.json());
    app.use("/api/admin", router);

    const res = await request(app)
      .post("/api/admin/users/create-landlord")
      .send({ email: "qa@example.com", password: "Password123!", plan: "pro" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.uid).toBe("user-123");
    expect(createUserMock).toHaveBeenCalled();
    expect(accountsSetMock).toHaveBeenCalled();
    expect(landlordsSetMock).toHaveBeenCalled();
    expect(onboardingSetMock).toHaveBeenCalled();
  });
});
