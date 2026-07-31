import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const documentGetMock = vi.hoisted(() => vi.fn());
const documentSetMock = vi.hoisted(() => vi.fn());

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({ getUser: getUserMock }),
  },
}));

vi.mock("../../firebase", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: documentGetMock,
        set: documentSetMock,
      }),
    }),
  },
}));

const originalEnv = { ...process.env };

describe("Identity Toolkit authentication failure logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.FIREBASE_API_KEY = "test-api-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("logs only the provider status, stable code, and a non-reversible email hash", async () => {
    const providerPayload = {
      error: {
        code: 400,
        message: "INVALID_PASSWORD : private provider context",
        errors: [{ message: "sensitive provider detail", domain: "global" }],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(providerPayload),
      text: vi.fn(),
    });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { signInWithPassword } = await import("../authService");

    await expect(signInWithPassword("private.user@example.com", "secret-password")).resolves.toBeNull();

    expect(warn).toHaveBeenCalledWith("[auth] firebase signInWithPassword failed", {
      status: 400,
      code: "INVALID_PASSWORD",
      emailHash: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
    const serializedLog = JSON.stringify(warn.mock.calls);
    expect(serializedLog).not.toContain("private.user@example.com");
    expect(serializedLog).not.toContain("secret-password");
    expect(serializedLog).not.toContain("sensitive provider detail");
    expect(serializedLog).not.toContain("private provider context");
    expect(serializedLog).not.toContain(JSON.stringify(providerPayload));
  });

  it("logs no raw email or UID while validating landlord credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          localId: "sensitive-firebase-uid",
          email: "private.user@example.com",
        }),
      })
    );
    getUserMock.mockResolvedValue({
      uid: "sensitive-firebase-uid",
      email: "private.user@example.com",
      emailVerified: true,
    });
    documentGetMock.mockResolvedValue({
      exists: true,
      data: () => ({
        id: "sensitive-firebase-uid",
        email: "private.user@example.com",
        role: "landlord",
      }),
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { validateLandlordCredentials } = await import("../authService");

    await expect(
      validateLandlordCredentials("private.user@example.com", "secret-password")
    ).resolves.toMatchObject({ role: "landlord" });

    expect(log).toHaveBeenCalledWith("[auth/validate] start", {
      emailHash: expect.stringMatching(/^[a-f0-9]{12}$/),
    });
    expect(log).toHaveBeenCalledWith("[auth/validate] firebase ok", {
      uidPresent: true,
    });
    const serializedOutput = JSON.stringify([
      ...log.mock.calls,
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
    expect(serializedOutput).not.toContain("private.user@example.com");
    expect(serializedOutput).not.toContain("sensitive-firebase-uid");
    expect(serializedOutput).not.toContain("secret-password");
  });
});
