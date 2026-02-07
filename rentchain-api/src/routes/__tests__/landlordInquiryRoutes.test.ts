import express from "express";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

const setMock = vi.fn();
const getMock = vi.fn().mockResolvedValue({ exists: false, data: () => null });
const docMock = vi.fn(() => ({ get: getMock, set: setMock }));
const collectionMock = vi.fn(() => ({ doc: docMock }));

vi.mock("../../config/firebase", () => ({
  db: {
    collection: collectionMock,
  },
}));

vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

describe("landlord inquiry rate limit", () => {
  it("returns ok on rate limit without creating a lead", async () => {
    process.env.LEAD_INQUIRY_RATE_LIMIT_MAX = "1";
    process.env.LEAD_INQUIRY_RATE_LIMIT_WINDOW_MS = "86400000";
    process.env.SENDGRID_API_KEY = "test";
    process.env.SENDGRID_FROM_EMAIL = "no-reply@example.com";

    vi.resetModules();
    const { publicRouter } = await import("../landlordInquiryRoutes");

    const app = express();
    app.use(express.json());
    app.use("/api/public", publicRouter);

    const payload = {
      email: "lead@example.com",
      firstName: "Jamie",
      portfolioSize: "1-5",
      note: "",
    };

    const res1 = await request(app).post("/api/public/landlord-inquiry").send(payload);
    expect(res1.status).toBe(200);

    const res2 = await request(app).post("/api/public/landlord-inquiry").send(payload);
    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
    expect(res2.body.rateLimited).toBe(true);
    expect(setMock).toHaveBeenCalledTimes(1);
  });
});
