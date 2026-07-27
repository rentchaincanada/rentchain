import { describe, expect, it } from "vitest";
import { getPreviewFoundationConfig } from "../previewFoundationConfig";

function preview(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: "preview",
    GOOGLE_CLOUD_PROJECT: "rentchain-preview",
    FIRESTORE_ENABLED: "true",
    FIRESTORE_DATABASE_ID: "(default)",
    PREVIEW_AUTH_ENABLED: "true",
    FIREBASE_PROJECT_ID: "rentchain-preview",
    FIREBASE_API_KEY: "preview-only-key",
    ...overrides,
  };
}

describe("previewFoundationConfig", () => {
  it("accepts the exact isolated Preview datastore and authentication boundary", () => {
    expect(getPreviewFoundationConfig(preview())).toEqual({
      environment: "preview",
      datastoreEnabled: true,
      authenticationEnabled: true,
      authenticationConfigured: true,
      authenticationOperationallyVerified: false,
      projectId: "rentchain-preview",
      databaseId: "(default)",
      firebaseApiKeyPresent: true,
    });
  });

  it("preserves the explicit deferred mode", () => {
    expect(
      getPreviewFoundationConfig(
        preview({
          FIRESTORE_ENABLED: "false",
          FIRESTORE_DATABASE_ID: undefined,
          PREVIEW_AUTH_ENABLED: "false",
          FIREBASE_PROJECT_ID: undefined,
          FIREBASE_API_KEY: undefined,
        })
      )
    ).toMatchObject({
      datastoreEnabled: false,
      authenticationEnabled: false,
      authenticationConfigured: false,
      authenticationOperationallyVerified: false,
    });
  });

  it("rejects production Firebase configuration", () => {
    expect(() =>
      getPreviewFoundationConfig(
        preview({
          FIREBASE_PROJECT_ID: "project-0d9658de-af29-4dc0-a99",
        })
      )
    ).toThrow(/production Firebase project/);
  });

  it("rejects authentication without the exact Preview Firebase project", () => {
    expect(() =>
      getPreviewFoundationConfig(
        preview({
          FIREBASE_PROJECT_ID: "other-preview",
        })
      )
    ).toThrow(/explicitly target rentchain-preview/);
  });

  it("rejects authentication without its Preview API key", () => {
    expect(() =>
      getPreviewFoundationConfig(
        preview({
          FIREBASE_API_KEY: undefined,
        })
      )
    ).toThrow(/isolated FIREBASE_API_KEY/);
  });

  it("does not treat API-key presence alone as configured authentication", () => {
    expect(
      getPreviewFoundationConfig(
        preview({
          PREVIEW_AUTH_ENABLED: "false",
        })
      )
    ).toMatchObject({
      authenticationEnabled: false,
      authenticationConfigured: false,
      authenticationOperationallyVerified: false,
      firebaseApiKeyPresent: true,
    });
  });
});
