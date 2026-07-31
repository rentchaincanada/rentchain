import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initializeAppMock = vi.hoisted(() => vi.fn());
const applicationDefaultMock = vi.hoisted(() => vi.fn(() => ({ kind: "application-default" })));
const authMock = vi.hoisted(() => vi.fn(() => ({ getUser: vi.fn() })));
const settingsMock = vi.hoisted(() => vi.fn());
const firestoreMock = vi.hoisted(() =>
  Object.assign(vi.fn(() => ({ settings: settingsMock })), {
    FieldValue: { serverTimestamp: vi.fn() },
  })
);
const apps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

vi.mock("firebase-admin", () => ({
  default: {
    apps,
    initializeApp: initializeAppMock,
    credential: { applicationDefault: applicationDefaultMock },
    auth: authMock,
    firestore: firestoreMock,
  },
}));

const originalEnv = { ...process.env };

function setPreviewDisabledEnvironment() {
  process.env.APP_ENV = "preview";
  process.env.NODE_ENV = "production";
  process.env.GOOGLE_CLOUD_PROJECT = "rentchain-preview";
  process.env.FIREBASE_PROJECT_ID = "rentchain-preview";
  process.env.FIREBASE_API_KEY = "preview-test-key";
  process.env.PREVIEW_AUTH_ENABLED = "true";
  process.env.FIRESTORE_ENABLED = "false";
  delete process.env.FIRESTORE_DATABASE_ID;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

async function importAdminModule() {
  return import("../admin");
}

describe("Firebase Admin initialization boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    apps.splice(0);
    initializeAppMock.mockImplementation((options) => {
      const app = { options };
      apps.push(app);
      return app;
    });
    setPreviewDisabledEnvironment();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("initializes Admin Auth exactly once while Preview Firestore remains disabled", async () => {
    const firebase = await importAdminModule();

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledWith({
      credential: { kind: "application-default" },
      projectId: "rentchain-preview",
    });
    expect(authMock()).toEqual(expect.objectContaining({ getUser: expect.any(Function) }));
    expect(firestoreMock).not.toHaveBeenCalled();
    expect(settingsMock).not.toHaveBeenCalled();
    expect(() => firebase.db.collection).toThrow(
      "[firebase] Firestore is disabled in Preview until separately provisioned."
    );
    expect(() => firebase.firestore.doc).toThrow(
      "[firebase] Firestore is disabled in Preview until separately provisioned."
    );
  });

  it("fails closed before initialization when Preview has no resolvable project ID", async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.FIREBASE_PROJECT_ID;

    await expect(importAdminModule()).rejects.toThrow(
      "[runtime-env] APP_ENV=preview requires GOOGLE_CLOUD_PROJECT=rentchain-preview."
    );
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  it("does not initialize a duplicate default app for multiple module consumers", async () => {
    await importAdminModule();
    vi.resetModules();
    await importAdminModule();

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(apps).toHaveLength(1);
    expect(firestoreMock).not.toHaveBeenCalled();
  });

  it("preserves non-disabled Preview Firestore initialization", async () => {
    process.env.FIRESTORE_ENABLED = "true";
    process.env.FIRESTORE_DATABASE_ID = "(default)";

    const firebase = await importAdminModule();

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(firestoreMock).toHaveBeenCalledTimes(1);
    expect(settingsMock).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
    expect(firebase.db).toEqual({ settings: settingsMock });
  });

  it("preserves Production Firebase and Firestore initialization", async () => {
    process.env.APP_ENV = "production";
    process.env.GOOGLE_CLOUD_PROJECT = "project-0d9658de-af29-4dc0-a99";
    process.env.FIREBASE_PROJECT_ID = "project-0d9658de-af29-4dc0-a99";
    process.env.FIRESTORE_ENABLED = "true";
    delete process.env.PREVIEW_AUTH_ENABLED;

    await importAdminModule();

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledWith({
      credential: { kind: "application-default" },
      projectId: "project-0d9658de-af29-4dc0-a99",
    });
    expect(firestoreMock).toHaveBeenCalledTimes(1);
    expect(settingsMock).toHaveBeenCalledWith({ ignoreUndefinedProperties: true });
  });
});
