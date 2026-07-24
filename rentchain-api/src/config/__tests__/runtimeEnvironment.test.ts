import { describe, expect, it } from "vitest";
import { assertRuntimeEnvironment, getConfiguredProjectId, getRuntimeEnvironment } from "../runtimeEnvironment";

describe("runtime environment contract", () => {
  it("requires the isolated Preview project", () => {
    expect(() => assertRuntimeEnvironment({ APP_ENV: "preview" } as NodeJS.ProcessEnv)).toThrow(/requires GOOGLE_CLOUD_PROJECT/);
    expect(() => assertRuntimeEnvironment({ APP_ENV: "preview", GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" } as NodeJS.ProcessEnv)).toThrow(/cannot target a production project/);
    expect(assertRuntimeEnvironment({ APP_ENV: "preview", GOOGLE_CLOUD_PROJECT: "rentchain-preview" } as NodeJS.ProcessEnv)).toBe("preview");
  });

  it("does not infer Preview from NODE_ENV", () => {
    expect(getRuntimeEnvironment({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("production");
    expect(getRuntimeEnvironment({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("development");
  });

  it("uses only explicit project markers", () => {
    expect(getConfiguredProjectId({ GOOGLE_CLOUD_PROJECT: "rentchain-preview" } as NodeJS.ProcessEnv)).toBe("rentchain-preview");
    expect(getConfiguredProjectId({} as NodeJS.ProcessEnv)).toBe("");
  });

  it("requires the approved project explicitly in production", () => {
    expect(() => assertRuntimeEnvironment({ APP_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/requires GOOGLE_CLOUD_PROJECT/);
    expect(() => assertRuntimeEnvironment({ APP_ENV: "production", GOOGLE_CLOUD_PROJECT: "rentchain-preview" } as NodeJS.ProcessEnv)).toThrow(/approved production project/);
    expect(assertRuntimeEnvironment({ APP_ENV: "production", GOOGLE_CLOUD_PROJECT: "project-0d9658de-af29-4dc0-a99" } as NodeJS.ProcessEnv)).toBe("production");
  });
});
